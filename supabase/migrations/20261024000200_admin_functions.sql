-- =====================================================================
-- Espace admin : fonctions (RPC) appelées par le back-office.
-- Chaque fonction revérifie le rôle EN BASE puis précise l'action et le
-- motif pour le journal d'audit (écrit par le trigger audit_staff_change).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Outils internes (non exposés à l'API)
-- ---------------------------------------------------------------------
create or replace function public.require_staff(p_admin_only boolean default false) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if (p_admin_only and not public.is_admin()) or (not p_admin_only and not public.is_staff()) then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
end $$;

create or replace function public.audit_context(p_action text, p_reason text default null) returns void
language plpgsql volatile set search_path = public as $$
begin
  perform set_config('ndoa.audit_action', coalesce(p_action, ''), true);
  perform set_config('ndoa.audit_reason', coalesce(p_reason, ''), true);
end $$;

-- Journal explicite pour les actions sans modification de données (consultation, export)
create or replace function public.write_audit(p_action text, p_target_type text, p_target_id text, p_vendor uuid,
                                              p_reason text default null, p_details jsonb default '{}'::jsonb) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, vendor_id, reason, details)
  values (auth.uid(), public.platform_role(), p_action, p_target_type, p_target_id, p_vendor, p_reason, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.vendor_contact_email(v uuid) returns text
language sql stable security definer set search_path = public, auth as $$
  select coalesce(x.email::text, (select u.email::text from auth.users u where u.id = x.owner_id))
    from public.vendors x where x.id = v;
$$;

create or replace function public.notify_vendor_team(v uuid, p_type text, p_title text, p_body text, p_link text) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.notifications (user_id, vendor_id, type, title, body, link)
  select m.user_id, v, p_type, p_title, p_body, p_link
    from public.vendor_members m
   where m.vendor_id = v and m.status = 'active' and m.user_id is not null;
$$;

create or replace function public.queue_email(p_to text, p_user uuid, p_template text, p_subject text, p_body text) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.email_outbox (to_email, to_user, template, subject, body)
  select p_to, p_user, p_template, p_subject, p_body where coalesce(p_to, '') <> '';
$$;

-- ---------------------------------------------------------------------
-- Prestataires : validation, badge, suspension, suppression
-- ---------------------------------------------------------------------
create or replace function public.admin_review_vendor(p_vendor uuid, p_decision text, p_reason text default null)
returns public.vendor_status language plpgsql security definer set search_path = public as $$
declare
  v public.vendors;
begin
  perform public.require_staff();
  select * into v from public.vendors where id = p_vendor for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;

  if p_decision = 'approve' then
    if v.status not in ('pending_review', 'rejected') then
      raise exception 'INVALID_STATE' using errcode = 'P0001';
    end if;
    perform public.audit_context('vendor.approve', p_reason);
    update public.vendors
       set status = 'published', approved_at = coalesce(approved_at, now()),
           reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null
     where id = p_vendor;
    perform public.notify_vendor_team(p_vendor, 'vendor_approved', 'Votre vitrine est en ligne',
      'Félicitations ! Votre vitrine a été validée par l’équipe NDOA.', '/espace');
    perform public.queue_email(public.vendor_contact_email(p_vendor), v.owner_id, 'vendor_approved',
      'Votre vitrine NDOA est en ligne',
      'Bonne nouvelle : votre vitrine « ' || v.name || ' » a été validée et est maintenant visible par les couples.');

  elsif p_decision = 'reject' then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
    if v.status <> 'pending_review' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
    perform public.audit_context('vendor.reject', p_reason);
    update public.vendors
       set status = 'rejected', rejection_reason = left(p_reason, 1000), reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_vendor;
    perform public.notify_vendor_team(p_vendor, 'vendor_rejected', 'Votre vitrine doit être complétée',
      left(p_reason, 140), '/espace/vitrine');
    perform public.queue_email(public.vendor_contact_email(p_vendor), v.owner_id, 'vendor_rejected',
      'Votre vitrine NDOA doit être complétée',
      'Votre vitrine « ' || v.name || ' » n’a pas encore pu être validée. Motif : ' || p_reason
      || E'\n\nCorrigez ces points depuis votre espace prestataire puis renvoyez-la en validation.');
  else
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;
  return (select status from public.vendors where id = p_vendor);
end $$;

-- Actions groupées (ex. : valider 10 profils d'un coup) ; une erreur n'annule pas les autres
create or replace function public.admin_review_vendors(p_ids uuid[], p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  vid uuid;
  done int := 0;
  errors jsonb := '[]'::jsonb;
begin
  perform public.require_staff();
  if cardinality(p_ids) > 100 then raise exception 'TOO_MANY' using errcode = 'P0001'; end if;
  foreach vid in array p_ids loop
    begin
      perform public.admin_review_vendor(vid, p_decision, p_reason);
      done := done + 1;
    exception when others then
      errors := errors || jsonb_build_object('id', vid, 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('ok', done, 'errors', errors);
end $$;

create or replace function public.admin_set_verified(p_vendor uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  perform public.audit_context(case when p_verified then 'vendor.verify' else 'vendor.unverify' end);
  update public.vendors set is_verified = p_verified where id = p_vendor;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

create or replace function public.admin_suspend_vendor(p_vendor uuid, p_suspend boolean, p_reason text default null)
returns public.vendor_status language plpgsql security definer set search_path = public as $$
declare v public.vendors;
begin
  perform public.require_staff(true);
  select * into v from public.vendors where id = p_vendor for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_suspend then
    if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
    perform public.audit_context('vendor.suspend', p_reason);
    update public.vendors set status = 'suspended', suspended_reason = left(p_reason, 1000) where id = p_vendor;
    perform public.notify_vendor_team(p_vendor, 'vendor_suspended', 'Votre vitrine est suspendue', left(p_reason, 140), '/espace');
    perform public.queue_email(public.vendor_contact_email(p_vendor), v.owner_id, 'vendor_suspended',
      'Votre vitrine NDOA est suspendue', 'Votre vitrine « ' || v.name || ' » a été suspendue. Motif : ' || p_reason);
  else
    if v.status <> 'suspended' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
    perform public.audit_context('vendor.unsuspend', p_reason);
    update public.vendors
       set status = case when approved_at is not null then 'published'::public.vendor_status else 'draft' end,
           suspended_reason = null
     where id = p_vendor;
  end if;
  return (select status from public.vendors where id = p_vendor);
end $$;

-- Suppression définitive : le slug doit être retapé (confirmation côté base)
create or replace function public.admin_delete_vendor(p_vendor uuid, p_confirm_slug text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v public.vendors;
begin
  perform public.require_staff(true);
  select * into v from public.vendors where id = p_vendor for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_confirm_slug is distinct from v.slug::text then raise exception 'CONFIRMATION_MISMATCH' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  perform public.queue_email(public.vendor_contact_email(p_vendor), v.owner_id, 'vendor_deleted',
    'Votre vitrine NDOA a été supprimée', 'Votre vitrine « ' || v.name || ' » a été supprimée. Motif : ' || p_reason);
  perform public.audit_context('vendor.delete', p_reason);
  delete from public.vendors where id = p_vendor;
end $$;

-- ---------------------------------------------------------------------
-- Modération : médias, avis, stories, vitrines signalées
-- ---------------------------------------------------------------------
create or replace function public.admin_moderate(p_target_type public.report_target, p_target_id uuid,
                                                 p_action text, p_reason text default null, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare
  vid uuid;
  handled int;
begin
  perform public.require_staff();
  if p_action not in ('approve', 'hide', 'delete') then raise exception 'INVALID_ACTION' using errcode = 'P0001'; end if;
  if p_action <> 'approve' and not public.moderation_reason_ok(p_reason) then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  perform public.audit_context(p_target_type::text || '.' || p_action, coalesce(p_reason, '') || coalesce(' : ' || p_note, ''));

  if p_target_type = 'media' then
    select vendor_id into vid from public.media where id = p_target_id;
    if vid is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if p_action = 'delete' then
      delete from public.media where id = p_target_id;   -- le fichier est retiré du stockage côté serveur
    else
      update public.media set is_hidden = (p_action = 'hide'), hidden_reason = case when p_action = 'hide' then p_reason end,
             moderated_by = auth.uid(), moderated_at = now() where id = p_target_id;
    end if;
    if p_action <> 'approve' then
      perform public.notify_vendor_team(vid, 'media_moderated', 'Un média a été retiré de votre vitrine', p_reason, '/espace/galerie');
    end if;

  elsif p_target_type = 'review' then
    select vendor_id into vid from public.reviews where id = p_target_id;
    if vid is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if p_action = 'delete' then
      delete from public.reviews where id = p_target_id;
    else
      update public.reviews set status = case when p_action = 'hide' then 'hidden'::public.review_status else 'published' end,
             hidden_reason = case when p_action = 'hide' then p_reason end,
             moderated_by = auth.uid(), moderated_at = now() where id = p_target_id;
    end if;

  elsif p_target_type = 'story' then
    select vendor_id into vid from public.stories where id = p_target_id;
    if vid is null then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if p_action = 'delete' then delete from public.stories where id = p_target_id;
    else update public.stories set is_archived = (p_action = 'hide') where id = p_target_id;
    end if;

  else  -- vitrine signalée : « approve » classe le signalement ; masquer = suspension (admin)
    vid := p_target_id;
    if p_action <> 'approve' then
      perform public.admin_suspend_vendor(p_target_id, true, p_reason || coalesce(' : ' || p_note, ''));
    end if;
  end if;

  update public.reports
     set status = case when p_action = 'approve' then 'dismissed'::public.report_status else 'resolved' end,
         resolution = p_action || coalesce(' · ' || p_reason, '') || coalesce(' · ' || p_note, ''),
         handled_by = auth.uid(), handled_at = now()
   where target_type = p_target_type and target_id = p_target_id and status = 'open';
  get diagnostics handled = row_count;
  return handled;
end $$;

-- Signalement par un visiteur (site public) : anti-abus, dédoublonné
create or replace function public.report_content(p_target_type public.report_target, p_target_id uuid, p_reason text,
                                                 p_details text default null, p_contact text default null, p_visitor text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  vid uuid;
  existing uuid;
  rid uuid;
begin
  if not public.moderation_reason_ok(p_reason) then raise exception 'REASON_INVALID' using errcode = 'P0001'; end if;
  vid := case p_target_type
    when 'media'  then (select m.vendor_id from public.media m where m.id = p_target_id and m.status = 'ready' and not m.is_hidden)
    when 'review' then (select r.vendor_id from public.reviews r where r.id = p_target_id and r.status = 'published')
    when 'story'  then (select s.vendor_id from public.stories s where s.id = p_target_id and not s.is_archived)
    when 'vendor' then (select x.id from public.vendors x where x.id = p_target_id)
  end;
  if vid is null or not public.vendor_is_public(vid) then raise exception 'TARGET_NOT_FOUND' using errcode = 'P0002'; end if;

  select id into existing from public.reports
   where target_type = p_target_type and target_id = p_target_id and status = 'open'
     and ((auth.uid() is not null and reporter_id = auth.uid()) or (p_visitor is not null and reporter_visitor = p_visitor))
   limit 1;
  if existing is not null then return existing; end if;

  if (select count(*) from public.reports
       where created_at > now() - interval '1 hour'
         and ((auth.uid() is not null and reporter_id = auth.uid()) or (p_visitor is not null and reporter_visitor = p_visitor))) >= 10
     or (select count(*) from public.reports where created_at > now() - interval '1 hour' and reporter_id is null) >= 500 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.reports (target_type, target_id, vendor_id, reason, details, reporter_id, reporter_contact, reporter_visitor)
  values (p_target_type, p_target_id, vid, p_reason, left(p_details, 1000), auth.uid(), left(p_contact, 200), left(p_visitor, 64))
  returning id into rid;
  return rid;
end $$;

-- ---------------------------------------------------------------------
-- Utilisateurs et équipe admin
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role public.platform_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  if p_user = auth.uid() then raise exception 'ROLE_SELF_CHANGE' using errcode = '42501'; end if;
  perform public.audit_context('user.role', p_role::text);
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
end $$;

-- Suspension en base (droits retirés, vitrines suspendues) ; le blocage de connexion
-- est appliqué côté serveur via l'API Auth (service_role, jamais dans le navigateur).
create or replace function public.admin_suspend_user(p_user uuid, p_suspend boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform public.require_staff(true);
  if p_user = auth.uid() then raise exception 'SELF_FORBIDDEN' using errcode = '42501'; end if;
  if p_suspend and coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  perform public.audit_context(case when p_suspend then 'user.suspend' else 'user.unsuspend' end, p_reason);
  update public.profiles
     set suspended_at = case when p_suspend then now() end,
         suspended_reason = case when p_suspend then left(p_reason, 500) end
   where id = p_user;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_suspend then
    for v in select id from public.vendors where owner_id = p_user and status <> 'suspended' loop
      perform public.admin_suspend_vendor(v, true, 'Compte suspendu : ' || p_reason);
    end loop;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Abonnements et paiements
-- ---------------------------------------------------------------------
create or replace function public.admin_set_subscription(p_vendor uuid, p_plan text, p_period_end timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  perform public.audit_context('subscription.set', p_reason);
  insert into public.subscriptions (vendor_id, plan_id, status, current_period_end, updated_at)
  values (p_vendor, p_plan, 'active', p_period_end, now())
  on conflict (vendor_id) do update
    set plan_id = excluded.plan_id, status = 'active', current_period_end = excluded.current_period_end,
        cancel_at_period_end = false, updated_at = now();
end $$;

-- Marque une facture remboursée (le remboursement chez l'opérateur est fait côté serveur)
create or replace function public.admin_refund_invoice(p_invoice uuid, p_amount bigint, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare inv public.invoices;
begin
  perform public.require_staff(true);
  select * into inv from public.invoices where id = p_invoice for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if inv.status <> 'paid' then raise exception 'INVALID_STATE' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > inv.amount then raise exception 'AMOUNT_INVALID' using errcode = 'P0001'; end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'REASON_REQUIRED' using errcode = 'P0001'; end if;
  perform public.audit_context('invoice.refund', p_reason);
  update public.invoices
     set status = 'refunded', refunded_at = now(), refund_amount = p_amount, refund_reason = left(p_reason, 500), refunded_by = auth.uid()
   where id = p_invoice;
end $$;

-- ---------------------------------------------------------------------
-- Communication : envoi d'une annonce aux équipes des prestataires ciblés
-- ---------------------------------------------------------------------
create or replace function public.admin_send_announcement(p_id uuid) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare
  a   public.announcements;
  ids uuid[];
  n   int;
begin
  perform public.require_staff(true);
  select * into a from public.announcements where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if a.status = 'sent' then raise exception 'ALREADY_SENT' using errcode = 'P0001'; end if;

  select coalesce(array_agg(distinct m.user_id), '{}') into ids
    from public.vendors v
    join public.vendor_members m on m.vendor_id = v.id and m.status = 'active' and m.user_id is not null
    left join public.subscriptions s on s.vendor_id = v.id
   where (not (a.audience ? 'statuses') or v.status::text in (select jsonb_array_elements_text(a.audience -> 'statuses')))
     and (not (a.audience ? 'plans') or coalesce(s.plan_id, 'free') in (select jsonb_array_elements_text(a.audience -> 'plans')))
     and (not (a.audience ? 'cities') or v.city in (select jsonb_array_elements_text(a.audience -> 'cities')))
     and (not (a.audience ? 'categories') or exists (
           select 1 from public.vendor_categories vc join public.categories c on c.id = vc.category_id
            where vc.vendor_id = v.id and c.slug in (select jsonb_array_elements_text(a.audience -> 'categories'))));
  n := cardinality(ids);

  if 'in_app' = any (a.channels) then
    insert into public.notifications (user_id, type, title, body, link)
    select uid, 'announcement', a.title, left(a.body, 500), '/espace' from unnest(ids) uid;
  end if;
  if 'email' = any (a.channels) then
    insert into public.email_outbox (to_email, to_user, template, subject, body)
    select u.email, u.id, 'announcement', a.title, a.body
      from auth.users u where u.id = any (ids) and coalesce(u.email, '') <> '';
  end if;

  perform public.audit_context('announcement.send', n || ' destinataires');
  update public.announcements set status = 'sent', sent_at = now(), recipients_count = n where id = p_id;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Tableau de bord et statistiques
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d     int := least(greatest(coalesce(p_days, 30), 7), 90);
  since date := current_date - (d - 1);
begin
  perform public.require_staff();
  return jsonb_build_object(
    'periode_jours', d,
    'inscrits', (select count(*) from public.profiles where deleted_at is null),
    'inscrits_periode', (select count(*) from public.profiles where created_at >= since),
    'prestataires_actifs', (select count(*) from public.vendors where status = 'published'),
    'en_attente', (select count(*) from public.vendors where status = 'pending_review'),
    'demandes_periode', (select count(*) from public.inquiries where created_at >= since),
    'visites_periode', (select count(*) from public.analytics_events where event = 'profile_view' and created_at >= since),
    -- montants réservés aux admins
    'revenus_mois', case when public.is_admin() then (
        select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
          from (select currency::text, sum(amount) total from public.invoices
                 where status = 'paid' and paid_at >= date_trunc('month', now()) group by currency) x) end,
    'alertes', jsonb_build_object(
      'medias_signales', (select count(*) from public.reports where status = 'open' and target_type in ('media', 'story')),
      'avis_signales', (select count(*) from public.reports where status = 'open' and target_type = 'review'),
      'vitrines_signalees', (select count(*) from public.reports where status = 'open' and target_type = 'vendor'),
      'avis_en_attente', (select count(*) from public.reviews where status = 'pending'),
      'prestataires_en_attente', (select count(*) from public.vendors where status = 'pending_review')),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'jour', g.day, 'inscrits', coalesce(p.n, 0), 'prestataires', coalesce(v.n, 0),
               'demandes', coalesce(i.n, 0), 'visites', coalesce(e.n, 0)) order by g.day), '[]'::jsonb)
        from (select generate_series(since, current_date, interval '1 day')::date as day) g
        left join (select created_at::date as day, count(*) as n from public.profiles where created_at >= since group by 1) p on p.day = g.day
        left join (select created_at::date as day, count(*) as n from public.vendors where created_at >= since group by 1) v on v.day = g.day
        left join (select created_at::date as day, count(*) as n from public.inquiries where created_at >= since group by 1) i on i.day = g.day
        left join (select created_at::date as day, count(*) as n from public.analytics_events
                    where event = 'profile_view' and created_at >= since group by 1) e on e.day = g.day)
  );
end $$;

-- Taux de réponse aux demandes de devis, par prestataire
create or replace function public.admin_inquiry_stats(p_days integer default 30)
returns table (vendor_id uuid, vendor_name text, vendor_slug text, total bigint, answered bigint,
               response_rate numeric, avg_response_hours numeric, unanswered_48h bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  return query
  select v.id, v.name, v.slug::text, count(i.id),
         count(i.first_response_at),
         round(count(i.first_response_at)::numeric / nullif(count(i.id), 0), 3),
         round(avg(extract(epoch from (i.first_response_at - i.created_at)) / 3600)::numeric, 1),
         count(i.id) filter (where i.first_response_at is null and i.created_at < now() - interval '48 hours')
    from public.vendors v
    join public.inquiries i on i.vendor_id = v.id and i.created_at >= now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365))
   group by v.id, v.name, v.slug
   order by 8 desc, 4 desc;
end $$;

-- Actions sans modification de données à tracer (consultation « en tant que », export CSV)
create or replace function public.admin_log(p_action text, p_target_type text, p_target_id text default null, p_vendor uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  if p_action not in ('vendor.view_as', 'export.csv', 'user.view') then raise exception 'INVALID_ACTION' using errcode = 'P0001'; end if;
  perform public.write_audit(p_action, left(p_target_type, 40), left(p_target_id, 80), p_vendor);
end $$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
revoke execute on function public.require_staff(boolean) from public, anon, authenticated;
revoke execute on function public.audit_context(text, text) from public, anon, authenticated;
revoke execute on function public.write_audit(text, text, text, uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.vendor_contact_email(uuid) from public, anon, authenticated;
revoke execute on function public.notify_vendor_team(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.queue_email(text, uuid, text, text, text) from public, anon, authenticated;

do $$
declare f regprocedure;
begin
  -- fonctions admin_* : comptes connectés uniquement (le rôle est revérifié à l'intérieur)
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'admin\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- nouvelles fonctions de trigger : jamais appelables via l'API
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.report_content(public.report_target, uuid, text, text, text, text) to anon, authenticated;
