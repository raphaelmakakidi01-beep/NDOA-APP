-- =====================================================================
-- Site public branché sur la base : cartes prestataires, accueil enrichi, annuaire
-- (lu par assets/ndoa.js et scripts/build-seo.mjs avec la clé publique)
-- =====================================================================

-- Carte publique d'une vitrine : ce qu'affichent l'accueil, le feed et les pages SEO.
-- Interne (security definer) : appelée uniquement par les fonctions ci-dessous.
create or replace function public.vendor_card(p_vendor_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', v.id, 'slug', v.slug::text, 'name', v.name, 'tagline', v.tagline, 'city', v.city,
    'is_verified', v.is_verified, 'is_recommended', v.is_recommended,
    'rating_avg', v.rating_avg, 'rating_count', v.rating_count, 'followers_count', v.followers_count,
    'avatar_path', v.avatar_path,
    'category', pc.slug, 'category_name', pc.name,
    -- photo de couverture choisie, sinon la première photo « à la une », sinon la première de la galerie
    'cover_path', coalesce(
      (select m.storage_path from public.media m where m.id = v.cover_media_id and m.kind = 'photo' and m.status = 'ready' and not m.is_hidden),
      (select m.storage_path from public.media m where m.vendor_id = v.id and m.kind = 'photo' and m.status = 'ready' and not m.is_hidden
        order by m.is_featured desc, m.sort, m.created_at limit 1)),
    'photos', coalesce((select jsonb_agg(x.storage_path) from (
        select m.storage_path from public.media m where m.vendor_id = v.id and m.kind = 'photo' and m.status = 'ready' and not m.is_hidden
         order by m.is_featured desc, m.sort, m.created_at limit 3) x), '[]'::jsonb),
    -- « à partir de » en dollars (les montants USD sont stockés en centimes)
    'price_from', (select round(min(p.price_amount) / 100.0) from public.packages p
                    where p.vendor_id = v.id and p.is_visible and p.currency = 'USD')
  )
  from public.vendors v
  left join lateral (select c.slug, c.name from public.vendor_categories vc join public.categories c on c.id = vc.category_id
                      where vc.vendor_id = v.id order by vc.is_primary desc, c.sort limit 1) pc on true
  where v.id = p_vendor_id and v.status = 'published';
$$;
revoke execute on function public.vendor_card(uuid) from public, anon, authenticated;

-- Annuaire public (feed de l'accueil, profils similaires, génération SEO)
create or replace function public.get_public_vendors(p_limit int default 500) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.vendor_card(x.id) order by x.is_recommended desc, x.rating_avg desc, x.rating_count desc, x.published_at desc), '[]'::jsonb)
    from (select v.id, v.is_recommended, v.rating_avg, v.rating_count, v.published_at from public.vendors v
           where v.status = 'published'
           order by v.is_recommended desc, v.rating_avg desc, v.rating_count desc, v.published_at desc
           limit least(greatest(coalesce(p_limit, 500), 1), 1000)) x;
$$;
revoke execute on function public.get_public_vendors(int) from public;
grant execute on function public.get_public_vendors(int) to anon, authenticated;

-- Accueil : mêmes règles qu'avant (actif, dans sa période, vitrine publiée), cartes complètes,
-- pages des stories et nombre de prestataires par catégorie
create or replace function public.get_home_content() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slides', coalesce((
      select jsonb_agg(jsonb_build_object('title', s.title, 'subtitle', s.subtitle, 'image_path', s.image_path,
               'media_path', m.storage_path, 'media_kind', m.kind, 'poster_path', m.poster_path, 'vendor', c.card) order by s.sort)
        from public.featured_slides s
        cross join lateral (select public.vendor_card(s.vendor_id) as card) c
        left join public.media m on m.id = s.media_id and m.status = 'ready' and not m.is_hidden
       where c.card is not null and s.is_active
         and (s.starts_at is null or s.starts_at <= now()) and (s.ends_at is null or s.ends_at > now())), '[]'::jsonb),
    'a_la_une', (
      select c.card from public.home_picks p cross join lateral (select public.vendor_card(p.vendor_id) as card) c
       where c.card is not null and p.section = 'a_la_une'
         and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now()) limit 1),
    'recommandations', coalesce((
      select jsonb_agg(c.card order by p.sort) from public.home_picks p cross join lateral (select public.vendor_card(p.vendor_id) as card) c
       where c.card is not null and p.section = 'recommandations'
         and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now())), '[]'::jsonb),
    'stories', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'title', st.title, 'cover_path', cm.storage_path, 'vendor', c.card,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object('path', case when im.kind = 'video' then im.poster_path else im.storage_path end,
                          'caption', si.caption) order by si.sort)
                   from public.story_items si join public.media im on im.id = si.media_id and im.status = 'ready' and not im.is_hidden
                  where si.story_id = st.id and (im.kind = 'photo' or im.poster_path is not null)), '[]'::jsonb)) order by f.sort)
        from public.featured_stories f
        join public.stories st on st.id = f.story_id and not st.is_archived and (st.expires_at is null or st.expires_at > now())
        cross join lateral (select public.vendor_card(st.vendor_id) as card) c
        left join public.media cm on cm.id = st.cover_media_id and cm.status = 'ready' and not cm.is_hidden
       where c.card is not null
         and (f.starts_at is null or f.starts_at <= now()) and (f.ends_at is null or f.ends_at > now())), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name, 'name_plural', c.name_plural, 'icon', c.icon, 'image_path', c.image_path,
               'vendor_count', (select count(*) from public.vendor_categories vc join public.vendors v on v.id = vc.vendor_id and v.status = 'published'
                                 where vc.category_id = c.id)) order by c.sort)
        from public.categories c where c.is_active), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('slug', ci.slug, 'name', ci.name) order by ci.sort) from public.cities ci where ci.is_active), '[]'::jsonb)
  );
$$;
grant execute on function public.get_home_content() to anon, authenticated;

-- Recherche par date : vitrines déjà réservées ou bloquées ce jour-là (aucun détail exposé)
create or replace function public.get_unavailable_vendor_slugs(p_day date) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(v.slug::text), '{}') from public.availability a join public.vendors v on v.id = a.vendor_id
   where a.day = p_day and a.status in ('booked', 'blocked') and v.status = 'published';
$$;
revoke execute on function public.get_unavailable_vendor_slugs(date) from public;
grant execute on function public.get_unavailable_vendor_slugs(date) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Compte couple (facultatif) : favoris et prestataires suivis
-- ---------------------------------------------------------------------
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, vendor_id)
);
alter table public.favorites enable row level security;
create policy favorites_self on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Compteur d'abonnés tenu par la base (le champ n'est pas modifiable par les prestataires)
create or replace function public.sync_followers_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.vendors set followers_count = (select count(*) from public.followers f where f.vendor_id = coalesce(new.vendor_id, old.vendor_id))
   where id = coalesce(new.vendor_id, old.vendor_id);
  return null;
end $$;
drop trigger if exists followers_count_sync on public.followers;
create trigger followers_count_sync after insert or delete on public.followers
  for each row execute function public.sync_followers_count();
