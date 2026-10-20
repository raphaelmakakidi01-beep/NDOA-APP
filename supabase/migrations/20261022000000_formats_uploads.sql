-- =====================================================================
-- Formats d'upload pour la production : JPEG, PNG, WebP (photos) et MP4 (vidéos).
-- Les photos sont compressées en WebP dans le navigateur (≈ 1,5 Mo, 2 560 px max) :
-- le serveur refuse toute photo de plus de 5 Mo (fichier non compressé ou envoi forgé).
-- =====================================================================

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
 where id = 'vendor-media';

-- Contrainte de la table media (nom généré par Postgres : on la retrouve par son contenu)
do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.media'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%mime_type%'
  loop
    execute format('alter table public.media drop constraint %I', c);
  end loop;
end $$;
alter table public.media add constraint media_mime_check check (
  (kind = 'photo' and mime_type in ('image/jpeg', 'image/png', 'image/webp'))
  or (kind = 'video' and mime_type = 'video/mp4')
) not valid;  -- les éventuels médias existants restent lisibles ; les nouveaux sont contrôlés

create or replace function public.verify_media_object() returns trigger
language plpgsql security definer set search_path = public, storage as $$
declare
  obj   record;
  mime  text;
  size  bigint;
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
