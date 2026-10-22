-- =====================================================================
-- Espace admin (étape 4) : utilisateurs, demandes de devis, communication,
-- équipe, réglages. Toutes les fonctions revérifient le rôle en base.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. UTILISATEURS
-- ---------------------------------------------------------------------
-- Liste paginée (l'e-mail vit dans auth.users : lisible uniquement par cette fonction, admin)
create or replace function public.admin_list_users(p_q text default null, p_role text default null, p_status text default null,
                                                   p_limit int default 25, p_offset int default 0)
returns table (id uuid, full_name text, email text, phone text, role public.platform_role, created_at timestamptz,
               last_sign_in_at timestamptz, suspended_at timestamptz, deleted_at timestamptz, vendors bigint, inquiries bigint, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.require_staff(true);
  return query
  with base as (
    select p.id, p.full_name, u.email::text as email, coalesce(p.phone, u.phone) as phone, p.role, p.created_at,
           u.last_sign_in_at, p.suspended_at, p.deleted_at
      from public.profiles p left join auth.users u on u.id = p.id
     where (q is null or p.full_name ilike '%' || q || '%' or u.email ilike '%' || q || '%' or coalesce(p.phone, u.phone, '') ilike '%' || q || '%')
       and (p_role is null or p_role = '' or p.role::text = p_role)
       and (p_status is null or p_status = ''
            or (p_status = 'active' and p.suspended_at is null and p.deleted_at is null)
            or (p_status = 'suspended' and p.suspended_at is not null)
            or (p_status = 'deleted' and p.deleted_at is not null))
  )
  select b.id, b.full_name, b.email, b.phone, b.role, b.created_at, b.last_sign_in_at, b.suspended_at, b.deleted_at,
         (select count(*) from public.vendors v where v.owner_id = b.id),
         (select count(*) from public.inquiries i where i.couple_user_id = b.id),
         count(*) over ()
    from base b
   order by b.created_at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

create or replace function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare
  r   jsonb;
  fav bigint := 0;
begin
  perform public.require_staff(true);
  -- favoris (table du compte couple) : lus seulement si la table existe
  if to_regclass('public.favorites') is not null then
    execute 'select count(*) from public.favorites where user_id = $1' into fav using p_user;
  end if;
  select jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', u.email, 'phone', coalesce(p.phone, u.phone), 'role', p.role,
    'created_at', p.created_at, 'last_sign_in_at', u.last_sign_in_at, 'suspended_at', p.suspended_at,
    'suspended_reason', p.suspended_reason, 'deleted_at', p.deleted_at,
    'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
    'vendors', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'slug', v.slug, 'status', v.status)) from public.vendors v where v.owner_id = p.id), '[]'::jsonb),
    'inquiries', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'vendor', v.name, 'vendor_id', v.id, 'status', i.status, 'wedding_date', i.wedding_date, 'created_at', i.created_at) order by i.created_at desc)
                             from public.inquiries i join public.vendors v on v.id = i.vendor_id where i.couple_user_id = p.id), '[]'::jsonb),
    'favorites', fav,
    'follows', (select count(*) from public.followers f where f.user_id = p.id)
  ) into r
  from public.profiles p left join auth.users u on u.id = p.id
  where p.id = p_user;
  if r is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.write_audit('user.view', 'profiles', p_user::text, null);
  return r;
end $$;

-- Suppression d'un compte (droit à l'effacement) : préparée ici, finalisée côté serveur (API Auth).
-- Les demandes envoyées restent chez les prestataires mais sont anonymisées.
create or replace function public.admin_prepare_user_deletion(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  if p_user = auth.uid() then raise exception 'SELF_FORBIDDEN' using errcode = '42501'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  if exists (select 1 from public.vendors where owner_id = p_user) then
    raise exception 'HAS_VENDOR' using errcode = 'P0001';   -- supprimer d'abord sa vitrine
  end if;
  if (select role from public.profiles where id = p_user) in ('admin', 'moderateur') then
    raise exception 'STAFF_ACCOUNT' using errcode = 'P0001'; -- retirer d'abord son rôle
  end if;
  perform public.audit_context('user.delete', p_reason);
  update public.inquiries
     set couple_names = 'Compte supprimé', email = 'supprime+' || left(id::text, 8) || '@ndoa.invalid', phone = null, couple_user_id = null
   where couple_user_id = p_user;
  update public.profiles set deleted_at = now(), full_name = null, phone = null, avatar_path = null where id = p_user;
end $$;

-- Nommer un compte existant (par e-mail) dans l'équipe
create or replace function public.admin_set_role_by_email(p_email text, p_role public.platform_role) returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  perform public.require_staff(true);
  select u.id into uid from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
  if uid is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform public.admin_set_role(uid, p_role);
  return uid;
end $$;

-- ---------------------------------------------------------------------
-- 2. DEMANDES DE DEVIS
-- ---------------------------------------------------------------------
create or replace function public.admin_inquiry_overview(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  perform public.require_staff(true);
  return (
    select jsonb_build_object(
      'total', count(*),
      'answered', count(first_response_at),
      'response_rate', round(count(first_response_at)::numeric / nullif(count(*), 0), 3),
      'avg_response_hours', round(avg(extract(epoch from (first_response_at - created_at)) / 3600)::numeric, 1),
      'unanswered_48h', count(*) filter (where first_response_at is null and created_at < now() - interval '48 hours'),
      'confirmed', count(*) filter (where status = 'confirmed'),
      'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (
                      select status, count(*) n from public.inquiries where created_at >= now() - make_interval(days => d) group by status) s)
    )
    from public.inquiries where created_at >= now() - make_interval(days => d)
  );
end $$;

-- Relance d'un prestataire pour une demande sans réponse (une fois par 24 h et par demande)
create or replace function public.admin_nudge_vendor(p_inquiry uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i public.inquiries; vname text; owner uuid;
begin
  perform public.require_staff(true);
  select * into i from public.inquiries where id = p_inquiry;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if i.first_response_at is not null then raise exception 'ALREADY_ANSWERED' using errcode = 'P0001'; end if;
  if exists (select 1 from public.audit_logs where action = 'inquiry.nudge' and target_id = p_inquiry::text and created_at > now() - interval '24 hours') then
    raise exception 'ALREADY_NUDGED' using errcode = 'P0001';
  end if;
  select name, owner_id into vname, owner from public.vendors where id = i.vendor_id;
  perform public.notify_vendor_team(i.vendor_id, 'inquiry_nudge', 'Une demande attend votre réponse',
    i.couple_names || coalesce(' · mariage le ' || to_char(i.wedding_date, 'DD/MM/YYYY'), '') || ' — répondez vite pour ne pas la perdre.',
    '/espace/demandes/' || i.id);
  perform public.queue_email(public.vendor_contact_email(i.vendor_id), owner, 'inquiry_nudge',
    'Une demande de devis attend votre réponse',
    'Bonjour, la demande de ' || i.couple_names || ' reçue le ' || to_char(i.created_at, 'DD/MM/YYYY') ||
    ' n’a pas encore de réponse. Les couples choisissent souvent le premier prestataire qui répond : connectez-vous à votre espace NDOA.');
  perform public.write_audit('inquiry.nudge', 'inquiries', p_inquiry::text, i.vendor_id);
end $$;

-- ---------------------------------------------------------------------
-- 3. COMMUNICATION : destinataires d'une annonce (aperçu avant envoi)
-- ---------------------------------------------------------------------
create or replace function public.announcement_recipients(p_audience jsonb) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct m.user_id), '{}')
    from public.vendors v
    join public.vendor_members m on m.vendor_id = v.id and m.status = 'active' and m.user_id is not null
    left join public.subscriptions s on s.vendor_id = v.id
   where (not (p_audience ? 'statuses') or v.status::text in (select jsonb_array_elements_text(p_audience -> 'statuses')))
     and (not (p_audience ? 'plans') or coalesce(s.plan_id, 'free') in (select jsonb_array_elements_text(p_audience -> 'plans')))
     and (not (p_audience ? 'cities') or v.city in (select jsonb_array_elements_text(p_audience -> 'cities')))
     and (not (p_audience ? 'categories') or exists (
           select 1 from public.vendor_categories vc join public.categories c on c.id = vc.category_id
            where vc.vendor_id = v.id and c.slug in (select jsonb_array_elements_text(p_audience -> 'categories'))));
$$;
revoke execute on function public.announcement_recipients(jsonb) from public, anon, authenticated;

create or replace function public.admin_announcement_audience(p_audience jsonb) returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  return cardinality(public.announcement_recipients(coalesce(p_audience, '{}'::jsonb)));
end $$;

-- ---------------------------------------------------------------------
-- 4. ORDRE : FAQ réordonnables
-- ---------------------------------------------------------------------
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
      when 'faqs'             then update public.faqs             set sort = i where id = p_ids[i]::uuid and sort is distinct from i;
      else raise exception 'INVALID_KIND' using errcode = 'P0001';
    end case;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. RÉGLAGE « validation obligatoire » : appliqué en base
-- ---------------------------------------------------------------------
create or replace function public.guard_vendor_system_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'OWNER_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  new.rating_avg       := old.rating_avg;
  new.rating_count     := old.rating_count;
  new.followers_count  := old.followers_count;
  new.response_minutes := old.response_minutes;
  new.created_at       := old.created_at;
  new.approved_at      := old.approved_at;
  new.reviewed_by      := old.reviewed_by;
  new.reviewed_at      := old.reviewed_at;
  new.rejection_reason := old.rejection_reason;
  new.suspended_reason := old.suspended_reason;
  new.submitted_at     := old.submitted_at;
  if new.status is not distinct from old.status then
    new.published_at := old.published_at;
    return new;
  end if;
  if not public.has_vendor_role(new.id, 'manager') then
    raise exception 'PUBLISH_MANAGER_ONLY' using errcode = '42501';
  end if;
  if old.status = 'suspended' then
    raise exception 'VENDOR_SUSPENDED' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'published') then
    raise exception 'STATUS_ADMIN_ONLY' using errcode = '42501';
  end if;
  if new.status = 'published' and old.approved_at is null then
    if coalesce((select value from public.site_settings where key = 'moderation.validation_obligatoire'), 'true'::jsonb) = 'false'::jsonb then
      -- validation désactivée par l'équipe : publication directe, considérée comme validée
      new.approved_at := now();
    else
      new.status           := 'pending_review';
      new.submitted_at     := now();
      new.published_at     := old.published_at;
      new.rejection_reason := null;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'admin\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
