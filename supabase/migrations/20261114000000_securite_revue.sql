-- Revue de sécurité du 14/11/2026

-- 1) Coordonnées des prestataires : plus lisibles en masse sans compte.
--    Avant : GET /rest/v1/vendors?select=phone,whatsapp,email renvoyait tous les numéros et e-mails
--    d'un coup (contournait le bouton « Afficher le numéro », sa limite et ses statistiques).
--    Les visiteurs anonymes n'ont plus accès qu'aux colonnes publiques ; le numéro passe par
--    vendor_contact() (une vitrine publiée à la fois), appelée par /api/prestataires/[slug]/contact.
--    ⚠ Toute nouvelle colonne publique de vendors doit être ajoutée au GRANT ci-dessous.
revoke select on public.vendors from anon;
grant select (
  id, slug, name, tagline, bio, style_tags, city, zones, languages, avatar_path, cover_media_id,
  socials, details, status, is_verified, is_recommended, rating_avg, rating_count, followers_count,
  response_minutes, published_at, created_at, updated_at
) on public.vendors to anon;

create or replace function public.vendor_contact(p_slug text)
returns table (phone text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select v.phone, v.whatsapp from public.vendors v where v.slug = p_slug and v.status = 'published';
$$;
revoke execute on function public.vendor_contact(text) from public;
grant execute on function public.vendor_contact(text) to anon, authenticated;

-- 2) Demandes de devis : un prestataire ne peut plus réécrire ce que le couple a envoyé
--    (nom, téléphone, e-mail, date, message…). Il garde la main sur le suivi : statut,
--    motif de perte, lecture, attribution. Les mises à jour faites par les fonctions du système
--    (dernier message, délai de réponse) et par l'équipe NDOA ne sont pas concernées.
create or replace function public.guard_inquiry_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_staff() then
    if (to_jsonb(new) - array['status', 'lost_reason', 'unread_vendor', 'assigned_to'])
       is distinct from (to_jsonb(old) - array['status', 'lost_reason', 'unread_vendor', 'assigned_to']) then
      raise exception 'INQUIRY_FIELDS_LOCKED' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists inquiries_guard on public.inquiries;
create trigger inquiries_guard before update on public.inquiries
  for each row execute function public.guard_inquiry_update();

-- 3) Stockage public des vitrines : 100 Mo par fichier au lieu de 500 Mo.
--    Les photos sont compressées (15 Mo max) et la seule vidéo autorisée aujourd'hui
--    (présentation de 30 s) est limitée à 100 Mo. À relever si les offres payantes ouvrent
--    des vidéos plus lourdes.
update storage.buckets set file_size_limit = 100 * 1024 * 1024 where id = 'vendor-media';
