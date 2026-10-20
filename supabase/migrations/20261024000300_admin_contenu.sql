-- =====================================================================
-- Espace admin (étape 3) : ordre par glisser-déposer et contenu public de l'accueil
-- =====================================================================

-- Réordonne une liste en un seul appel (une seule entrée « *.reorder » par élément au journal)
create or replace function public.admin_reorder(p_kind text, p_ids text[]) returns void
language plpgsql security definer set search_path = public as $$
declare i int;
begin
  perform public.require_staff(true);
  if cardinality(p_ids) > 500 then raise exception 'TOO_MANY' using errcode = 'P0001'; end if;
  perform public.audit_context(p_kind || '.reorder');
  for i in 1 .. coalesce(cardinality(p_ids), 0) loop
    case p_kind
      when 'featured_slides'  then update public.featured_slides  set sort = i where id = p_ids[i]::uuid and sort is distinct from i;
      when 'home_picks'       then update public.home_picks       set sort = i where id = p_ids[i]::uuid and sort is distinct from i;
      when 'featured_stories' then update public.featured_stories set sort = i where story_id = p_ids[i]::uuid and sort is distinct from i;
      when 'categories'       then update public.categories       set sort = i where id = p_ids[i]::smallint and sort is distinct from i;
      when 'cities'           then update public.cities           set sort = i where id = p_ids[i]::smallint and sort is distinct from i;
      else raise exception 'INVALID_KIND' using errcode = 'P0001';
    end case;
  end loop;
end $$;
revoke execute on function public.admin_reorder(text, text[]) from public, anon;
grant execute on function public.admin_reorder(text, text[]) to authenticated;

-- Contenu de l'accueil pour le site public : uniquement ce qui est actif, dans sa période
-- et lié à une vitrine publiée (même règles que la RLS, en un seul appel)
create or replace function public.get_home_content() returns jsonb
language sql stable security definer set search_path = public as $$
  with vend as (
    select v.id, v.slug::text slug, v.name, v.city, v.is_verified, v.rating_avg, v.rating_count, v.avatar_path,
           (select c.slug from public.vendor_categories vc join public.categories c on c.id = vc.category_id
             where vc.vendor_id = v.id order by vc.is_primary desc limit 1) as category
      from public.vendors v where v.status = 'published'
  ), active_period as (
    select now() as t
  )
  select jsonb_build_object(
    'slides', coalesce((
      select jsonb_agg(jsonb_build_object('title', s.title, 'subtitle', s.subtitle, 'image_path', s.image_path,
               'media_path', m.storage_path, 'media_kind', m.kind, 'poster_path', m.poster_path, 'vendor', to_jsonb(v)) order by s.sort)
        from public.featured_slides s join vend v on v.id = s.vendor_id
        left join public.media m on m.id = s.media_id and m.status = 'ready' and not m.is_hidden
       where s.is_active and (s.starts_at is null or s.starts_at <= now()) and (s.ends_at is null or s.ends_at > now())), '[]'::jsonb),
    'a_la_une', (
      select to_jsonb(v) from public.home_picks p join vend v on v.id = p.vendor_id
       where p.section = 'a_la_une' and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now()) limit 1),
    'recommandations', coalesce((
      select jsonb_agg(to_jsonb(v) order by p.sort) from public.home_picks p join vend v on v.id = p.vendor_id
       where p.section = 'recommandations' and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now())), '[]'::jsonb),
    'stories', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'title', st.title, 'cover_path', cm.storage_path, 'vendor', to_jsonb(v)) order by f.sort)
        from public.featured_stories f join public.stories st on st.id = f.story_id and not st.is_archived
        join vend v on v.id = st.vendor_id
        left join public.media cm on cm.id = st.cover_media_id and not cm.is_hidden
       where (f.starts_at is null or f.starts_at <= now()) and (f.ends_at is null or f.ends_at > now())), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name, 'name_plural', c.name_plural, 'icon', c.icon, 'image_path', c.image_path) order by c.sort)
        from public.categories c where c.is_active), '[]'::jsonb),
    'cities', coalesce((
      select jsonb_agg(jsonb_build_object('slug', ci.slug, 'name', ci.name) order by ci.sort) from public.cities ci where ci.is_active), '[]'::jsonb)
  );
$$;
grant execute on function public.get_home_content() to anon, authenticated;
