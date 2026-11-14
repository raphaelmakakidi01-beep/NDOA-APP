-- Test d'intrusion du 14/11/2026 (2e passe) : médias entre vitrines, règle vidéo, devis sans captcha

-- ---------------------------------------------------------------------------
-- 1) Médias : une vitrine ne peut utiliser QUE ses propres fichiers et médias.
--    Avant : l'affiche (poster_path) d'un média, l'avatar, la couverture, une story ou
--    la couverture d'un album pouvaient pointer vers ceux d'une autre vitrine
--    (vol de photos ; et si la modération supprimait ce média, le fichier de la VICTIME
--    était effacé du stockage).
-- ---------------------------------------------------------------------------
create or replace function public.media_of_vendor(p_media uuid, p_vendor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_media is null or exists (select 1 from public.media m where m.id = p_media and m.vendor_id = p_vendor);
$$;
revoke execute on function public.media_of_vendor(uuid, uuid) from public, anon;
grant execute on function public.media_of_vendor(uuid, uuid) to authenticated, service_role;

create or replace function public.verify_media_object() returns trigger
language plpgsql security definer set search_path = public, storage as $$
declare
  obj   record;
  mime  text;
  size  bigint;
  trusted boolean := public.is_staff() or coalesce(auth.role(), '') = 'service_role';
begin
  -- le fichier et son affiche doivent être dans le dossier du prestataire
  if public.storage_vendor_id(new.storage_path) is distinct from new.vendor_id
     or (new.poster_path is not null and public.storage_vendor_id(new.poster_path) is distinct from new.vendor_id) then
    raise exception 'MEDIA_PATH_FORBIDDEN' using errcode = '42501';
  end if;
  -- l'album doit appartenir à la même vitrine
  if new.album_id is not null and not exists (select 1 from public.albums a where a.id = new.album_id and a.vendor_id = new.vendor_id) then
    raise exception 'ALBUM_FORBIDDEN' using errcode = '42501';
  end if;
  -- après l'envoi, le type et la durée ne changent plus (sinon : photo transformée en vidéo de 10 min)
  if tg_op = 'UPDATE' and not trusted and (new.kind is distinct from old.kind or new.duration_s is distinct from old.duration_s) then
    raise exception 'MEDIA_FIELDS_LOCKED' using errcode = '42501';
  end if;
  select o.metadata into obj from storage.objects o
   where o.bucket_id = 'vendor-media' and o.name = new.storage_path;
  if not found then
    raise exception 'MEDIA_FILE_MISSING' using errcode = 'P0001';
  end if;
  mime := obj.metadata ->> 'mimetype';
  size := (obj.metadata ->> 'size')::bigint;
  if (new.kind = 'photo' and mime not in ('image/jpeg', 'image/png', 'image/webp'))
     or (new.kind = 'video' and mime is distinct from 'video/mp4') then
    raise exception 'MEDIA_TYPE_MISMATCH' using errcode = 'P0001';
  end if;
  if new.kind = 'photo' and size > 5 * 1024 * 1024 then
    raise exception 'FILE_TOO_LARGE' using errcode = 'P0001';
  end if;
  -- le fichier réel fait foi (quotas et affichage)
  new.size_bytes := coalesce(size, new.size_bytes);
  new.mime_type  := mime;
  return new;
end $$;
drop trigger if exists a_media_verify on public.media;
create trigger a_media_verify before insert or update of storage_path, poster_path, size_bytes, kind, mime_type, vendor_id, duration_s, album_id
  on public.media for each row execute function public.verify_media_object();

-- vitrine : avatar dans son dossier, couverture parmi ses médias
create or replace function public.guard_vendor_media() returns trigger
language plpgsql set search_path = public as $$
begin
  if public.is_staff() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path
     and public.storage_vendor_id(new.avatar_path) is distinct from new.id then
    raise exception 'MEDIA_PATH_FORBIDDEN' using errcode = '42501';
  end if;
  if new.cover_media_id is distinct from old.cover_media_id and not public.media_of_vendor(new.cover_media_id, new.id) then
    raise exception 'MEDIA_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists vendors_guard_media on public.vendors;
create trigger vendors_guard_media before update of avatar_path, cover_media_id on public.vendors
  for each row execute function public.guard_vendor_media();

-- albums et stories : couverture parmi les médias de la vitrine
create or replace function public.guard_cover_same_vendor() returns trigger
language plpgsql set search_path = public as $$
begin
  if not public.media_of_vendor(new.cover_media_id, new.vendor_id) then
    raise exception 'MEDIA_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists albums_guard_cover on public.albums;
create trigger albums_guard_cover before insert or update of cover_media_id, vendor_id on public.albums
  for each row execute function public.guard_cover_same_vendor();
drop trigger if exists stories_guard_cover on public.stories;
create trigger stories_guard_cover before insert or update of cover_media_id, vendor_id on public.stories
  for each row execute function public.guard_cover_same_vendor();

-- éléments de story : médias de la même vitrine que la story
create or replace function public.guard_story_item() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.stories s where s.id = new.story_id and public.media_of_vendor(new.media_id, s.vendor_id)) then
    raise exception 'MEDIA_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists story_items_guard on public.story_items;
create trigger story_items_guard before insert or update of media_id, story_id on public.story_items
  for each row execute function public.guard_story_item();

-- ---------------------------------------------------------------------------
-- 2) Quotas : deux envois simultanés ne peuvent plus dépasser la limite
--    (le comptage se fait maintenant un envoi à la fois par vitrine).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_media_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim       jsonb := public.vendor_limits(new.vendor_id);
  n         int;
  total     bigint;
  video_cat boolean;
begin
  perform pg_advisory_xact_lock(hashtext('media-quota:' || new.vendor_id::text));
  select exists (
    select 1 from public.vendor_categories vc join public.categories c on c.id = vc.category_id
      where vc.vendor_id = new.vendor_id and vc.is_primary and c.slug in ('videaste', 'drone')
  ) into video_cat;

  if new.kind = 'photo' and new.size_bytes > 15 * 1024 * 1024 then
    raise exception 'FILE_TOO_LARGE' using errcode = 'P0001';
  end if;

  select count(*) into n from public.media
    where vendor_id = new.vendor_id and kind = new.kind and status <> 'failed';

  if new.kind = 'video' and video_cat then
    if new.duration_s is null or new.duration_s > 31 then
      raise exception 'VIDEO_TOO_LONG' using errcode = 'P0001';
    end if;
    if new.size_bytes > 100 * 1024 * 1024 then
      raise exception 'FILE_TOO_LARGE' using errcode = 'P0001';
    end if;
    if n >= 1 then
      raise exception 'QUOTA_VIDEOS' using errcode = 'P0001';
    end if;
  elsif new.kind = 'video' then
    if new.size_bytes > (lim ->> 'max_video_mb')::bigint * 1024 * 1024 then
      raise exception 'FILE_TOO_LARGE' using errcode = 'P0001';
    end if;
    if n >= (lim ->> 'max_videos')::int then
      raise exception 'QUOTA_VIDEOS' using errcode = 'P0001';
    end if;
  end if;

  if new.kind = 'photo' and n >= (lim ->> 'max_photos')::int then
    raise exception 'QUOTA_PHOTOS' using errcode = 'P0001';
  end if;

  select coalesce(sum(size_bytes), 0) into total from public.media
    where vendor_id = new.vendor_id and status <> 'failed';
  if total + new.size_bytes > (lim ->> 'storage_mb')::bigint * 1024 * 1024 then
    raise exception 'QUOTA_STORAGE' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 3) Devis : chemin réservé au serveur du site (après vérification anti-spam Cloudflare).
--    submit_inquiry reste ouvert pour l'instant : il sera fermé au public dès que
--    SUPABASE_SERVICE_ROLE_KEY sera en place sur Vercel (migration suivante).
-- ---------------------------------------------------------------------------
create or replace function public.submit_inquiry_server(
  p_couple_user uuid, p_vendor_slug text, p_couple_names text, p_email text, p_phone text, p_contact_pref text,
  p_wedding_date date, p_city text, p_guests integer, p_package_id uuid, p_option_ids uuid[], p_message text, p_source text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'SERVER_ONLY' using errcode = '42501'; end if;
  -- même validation et mêmes limites que submit_inquiry, en se faisant passer pour le couple connecté
  perform set_config('request.jwt.claims', json_build_object('sub', p_couple_user, 'role', 'service_role')::text, true);
  new_id := public.submit_inquiry(p_vendor_slug, p_couple_names, p_email, p_phone, p_contact_pref, p_wedding_date,
                                  p_city, p_guests, p_package_id, p_option_ids, p_message, p_source);
  return new_id;
end $$;
revoke execute on function public.submit_inquiry_server(uuid, text, text, text, text, text, date, text, integer, uuid, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.submit_inquiry_server(uuid, text, text, text, text, text, date, text, integer, uuid, uuid[], text, text) to service_role;
