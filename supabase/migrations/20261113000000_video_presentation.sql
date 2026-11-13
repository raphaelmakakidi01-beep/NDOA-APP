-- Vidéastes et pilotes de drone : une vidéo de présentation (30 s maximum,
-- 100 Mo maximum) quelle que soit l'offre. Elle tourne en boucle dans la
-- couverture de leur fiche ; le reste de leur travail passe par des liens.
-- Les autres métiers gardent les limites de leur offre.
create or replace function public.enforce_media_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim       jsonb := public.vendor_limits(new.vendor_id);
  n         int;
  total     bigint;
  video_cat boolean;
begin
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
