-- =====================================================================
-- Durcissement suite au conseiller sécurité Supabase (supabase db advisors)
-- =====================================================================

-- 1. Les fonctions de trigger ne doivent pas être appelables via l'API (/rest/v1/rpc).
--    Postgres ne vérifie pas EXECUTE quand un trigger se déclenche : les triggers continuent de fonctionner.
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 2. Fonctions internes (utilisées par les triggers, jamais par le navigateur)
revoke execute on function public.vendor_limits(uuid) from public, anon, authenticated;
revoke execute on function public.vendor_completeness(uuid) from public, anon, authenticated;

-- 3. Statistiques de l'espace pro : réservées aux comptes connectés (le rôle est revérifié dans la fonction)
revoke execute on function public.top_photos(uuid, timestamptz) from public, anon;
revoke execute on function public.category_benchmark(uuid) from public, anon;

-- 4. search_path figé sur les fonctions qui n'en avaient pas
alter function public.role_rank(public.member_role) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.storage_vendor_id(text) set search_path = public, storage;

-- 5. Calendrier public : la vue SECURITY DEFINER est remplacée par une fonction explicite
--    (même données : jour et statut des vitrines publiées, jamais la note ni la demande liée)
drop view if exists public.public_availability;
create or replace function public.get_public_availability(p_vendor_slug text)
returns table (day date, status text)
language sql stable security definer set search_path = public as $$
  select a.day, a.status::text
    from public.availability a
    join public.vendors v on v.id = a.vendor_id
   where v.slug = p_vendor_slug and v.status = 'published' and a.day >= current_date
   order by a.day
   limit 400;
$$;
revoke execute on function public.get_public_availability(text) from public;
grant execute on function public.get_public_availability(text) to anon, authenticated;
