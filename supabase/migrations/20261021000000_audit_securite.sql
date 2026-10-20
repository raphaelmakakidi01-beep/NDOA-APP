-- =========================================================
-- Audit avant production : durcissement de la sécurité
-- Chaque bloc corrige un point listé dans docs/AUDIT-PRODUCTION.md
-- =========================================================

-- ---------------------------------------------------------
-- B1. Création de vitrine : l'onboarding fait insert(...).select("id").
--     La lecture du RETURNING est évaluée avant le trigger qui crée le
--     membre « owner » : sans cette règle, la création échouait (42501).
-- ---------------------------------------------------------
drop policy if exists vendors_read on public.vendors;
create policy vendors_read on public.vendors for select
  using (status = 'published' or owner_id = auth.uid() or public.has_vendor_role(id));

-- ---------------------------------------------------------
-- S1. Vendeurs : un membre d'équipe ne peut pas changer le
--     propriétaire, les compteurs ni les dates système
-- ---------------------------------------------------------
create or replace function public.guard_vendor_system_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'OWNER_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  -- valeurs calculées par la base : on ignore silencieusement toute tentative
  new.rating_avg       := old.rating_avg;
  new.rating_count     := old.rating_count;
  new.followers_count  := old.followers_count;
  new.response_minutes := old.response_minutes;
  new.created_at       := old.created_at;
  if new.status is not distinct from old.status then new.published_at := old.published_at; end if;
  -- seule l'équipe de direction (gérant ou propriétaire) publie ou dépublie
  if new.status is distinct from old.status and not public.has_vendor_role(new.id, 'manager') then
    raise exception 'PUBLISH_MANAGER_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists vendors_guard_system on public.vendors;
create trigger vendors_guard_system before update on public.vendors
  for each row execute function public.guard_vendor_system_fields();

-- ---------------------------------------------------------
-- S2. Avis : le prestataire peut seulement répondre.
--     Statut, note, auteur, vérification restent intouchables.
-- ---------------------------------------------------------
create or replace function public.guard_review_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' and (
       new.rating is distinct from old.rating or new.body is distinct from old.body
    or new.author_names is distinct from old.author_names or new.status is distinct from old.status
    or new.is_verified is distinct from old.is_verified or new.vendor_id is distinct from old.vendor_id
    or new.inquiry_id is distinct from old.inquiry_id or new.photo_path is distinct from old.photo_path
    or new.wedding_date is distinct from old.wedding_date or new.created_at is distinct from old.created_at) then
    raise exception 'REVIEW_READ_ONLY' using errcode = '42501';
  end if;
  if new.reply is distinct from old.reply then new.replied_at := case when new.reply is null then null else now() end; end if;
  return new;
end $$;

-- ---------------------------------------------------------
-- S3. Messages : la mise à jour ne sert qu'à marquer « lu »
-- ---------------------------------------------------------
create or replace function public.guard_message_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'MESSAGE_READ_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_guard on public.messages;
create trigger messages_guard before update on public.messages
  for each row execute function public.guard_message_update();

-- Notifications : même règle (seul read_at change)
create or replace function public.guard_notification_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'NOTIFICATION_READ_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists notifications_guard on public.notifications;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- ---------------------------------------------------------
-- S4. Médias : la taille et le type déclarés doivent
--     correspondre au fichier réellement stocké
-- ---------------------------------------------------------
create or replace function public.verify_media_object() returns trigger
language plpgsql security definer set search_path = public, storage as $$
declare
  obj   record;
  mime  text;
begin
  -- le fichier doit être dans le dossier du prestataire
  if public.storage_vendor_id(new.storage_path) is distinct from new.vendor_id then
    raise exception 'MEDIA_PATH_FORBIDDEN' using errcode = '42501';
  end if;
  select o.metadata into obj from storage.objects o
   where o.bucket_id = 'vendor-media' and o.name = new.storage_path;
  if not found then
    raise exception 'MEDIA_FILE_MISSING' using errcode = 'P0001';
  end if;
  mime := obj.metadata ->> 'mimetype';
  if (new.kind = 'photo' and mime not in ('image/jpeg', 'image/png', 'image/webp', 'image/avif'))
     or (new.kind = 'video' and mime not in ('video/mp4', 'video/webm', 'video/quicktime')) then
    raise exception 'MEDIA_TYPE_MISMATCH' using errcode = 'P0001';
  end if;
  -- le fichier réel fait foi (quotas et affichage)
  new.size_bytes := coalesce((obj.metadata ->> 'size')::bigint, new.size_bytes);
  new.mime_type  := mime;
  return new;
end $$;
drop trigger if exists media_verify on public.media;
-- « a_ » : s'exécute avant media_quota (ordre alphabétique des triggers)
create trigger a_media_verify before insert or update of storage_path, size_bytes, kind, mime_type, vendor_id on public.media
  for each row execute function public.verify_media_object();

-- ---------------------------------------------------------
-- S5. Équipe : l'ajout passe par l'invitation (Edge Function),
--     un gérant ne peut ni s'auto-promouvoir ni toucher au propriétaire
-- ---------------------------------------------------------
drop policy if exists members_write on public.vendor_members;
create policy members_insert on public.vendor_members for insert to authenticated
  with check (public.has_vendor_role(vendor_id, 'manager') and role <> 'owner' and status = 'invited' and user_id is null);
create policy members_update on public.vendor_members for update to authenticated
  using (public.has_vendor_role(vendor_id, 'manager') and role <> 'owner' and user_id is distinct from auth.uid())
  with check (public.has_vendor_role(vendor_id, 'manager') and role <> 'owner' and user_id is distinct from auth.uid());
create policy members_delete on public.vendor_members for delete to authenticated
  using (public.has_vendor_role(vendor_id, 'manager') and role <> 'owner');

-- ---------------------------------------------------------
-- S6. Stockage privé : remplacer / supprimer un devis existant
-- ---------------------------------------------------------
create policy private_modify on storage.objects for update to authenticated
  using (bucket_id = 'vendor-private' and public.has_vendor_role(public.storage_vendor_id(name), 'editor'));
create policy private_remove on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-private' and public.has_vendor_role(public.storage_vendor_id(name), 'editor'));

-- ---------------------------------------------------------
-- S7. Demande de devis publique (formulaire du profil)
--     Seul point d'entrée : validation + limites anti-abus
-- ---------------------------------------------------------
create or replace function public.submit_inquiry(
  p_vendor_slug text, p_couple_names text, p_email text, p_phone text, p_contact_pref text,
  p_wedding_date date, p_city text, p_guests int, p_package_id uuid, p_option_ids uuid[],
  p_message text, p_source text default 'profil'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id   uuid;
  new_id uuid;
  recent int;
begin
  select id into v_id from vendors where slug = p_vendor_slug and status = 'published';
  if v_id is null then raise exception 'VENDOR_NOT_FOUND' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_couple_names, ''))) not between 2 and 80 then raise exception 'NAMES_INVALID' using errcode = '22023'; end if;
  if coalesce(p_email, '') = '' and coalesce(p_phone, '') = '' then raise exception 'CONTACT_REQUIRED' using errcode = '22023'; end if;
  if p_email is not null and p_email <> '' and p_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'EMAIL_INVALID' using errcode = '22023'; end if;
  if p_phone is not null and p_phone <> '' and regexp_replace(p_phone, '\D', '', 'g') !~ '^\d{9,15}$' then raise exception 'PHONE_INVALID' using errcode = '22023'; end if;
  if p_wedding_date is not null and (p_wedding_date < current_date or p_wedding_date > current_date + interval '3 years') then raise exception 'DATE_INVALID' using errcode = '22023'; end if;
  if p_package_id is not null and not exists (select 1 from packages where id = p_package_id and vendor_id = v_id and is_visible) then p_package_id := null; end if;

  -- anti-abus : 3 demandes / 24 h par contact et par prestataire, 20 / heure au total
  select count(*) into recent from inquiries
   where vendor_id = v_id and created_at > now() - interval '24 hours'
     and (lower(email) = lower(nullif(p_email, '')) or phone = nullif(p_phone, ''));
  if recent >= 3 then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;
  select count(*) into recent from inquiries where vendor_id = v_id and created_at > now() - interval '1 hour';
  if recent >= 20 then raise exception 'RATE_LIMITED' using errcode = 'P0001'; end if;

  insert into inquiries (vendor_id, couple_user_id, couple_names, email, phone, contact_pref, wedding_date, city, guests,
                         package_id, option_ids, message, source)
  values (v_id, auth.uid(), left(trim(p_couple_names), 80), nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''),
          case when p_contact_pref in ('whatsapp', 'call', 'email') then p_contact_pref end,
          p_wedding_date, left(p_city, 60), case when p_guests between 1 and 5000 then p_guests end,
          p_package_id,
          coalesce((select array_agg(o) from unnest(coalesce(p_option_ids, '{}')) o where exists (select 1 from package_options po where po.id = o and po.vendor_id = v_id)), '{}'),
          left(p_message, 3000), left(coalesce(p_source, 'profil'), 30))
  returning id into new_id;

  insert into analytics_events (vendor_id, event, source) values (v_id, 'quote_request', left(coalesce(p_source, 'profil'), 30));
  return new_id;
end $$;
grant execute on function public.submit_inquiry(text, text, text, text, text, date, text, int, uuid, uuid[], text, text) to anon, authenticated;

-- ---------------------------------------------------------
-- S8. Statistiques publiques : événements whitelistés,
--     dédoublonnés par visiteur (30 min) pour éviter le gonflage
-- ---------------------------------------------------------
create or replace function public.track_event(p_vendor_slug text, p_event text, p_source text default null, p_media_id uuid default null, p_visitor text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_event not in ('profile_view', 'whatsapp_click', 'call_click', 'photo_view', 'share') then return; end if;
  select id into v_id from vendors where slug = p_vendor_slug and status = 'published';
  if v_id is null then return; end if;
  if p_media_id is not null and not exists (select 1 from media where id = p_media_id and vendor_id = v_id) then p_media_id := null; end if;
  if p_visitor is not null and exists (
      select 1 from analytics_events where vendor_id = v_id and event = p_event::analytics_event and visitor_id = left(p_visitor, 64)
        and media_id is not distinct from p_media_id and created_at > now() - interval '30 minutes') then
    return;
  end if;
  insert into analytics_events (vendor_id, event, source, media_id, visitor_id)
  values (v_id, p_event::analytics_event, left(p_source, 30), p_media_id, left(p_visitor, 64));
end $$;
grant execute on function public.track_event(text, text, text, uuid, text) to anon, authenticated;

-- Index pour les contrôles anti-abus
create index if not exists inquiries_vendor_created_idx on public.inquiries (vendor_id, created_at desc);
create index if not exists analytics_dedup_idx on public.analytics_events (vendor_id, visitor_id, event, created_at desc);
