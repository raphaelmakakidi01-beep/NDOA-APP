-- =====================================================================
-- Espace admin (2/2) : rôles, validation, modération, mise en avant,
-- contenus, communication, journal d'audit — tables et règles RLS.
--
-- Principes :
-- * le rôle est vérifié EN BASE (fonctions is_admin / is_staff), jamais seulement dans l'interface ;
-- * admin : accès complet (lecture et écriture), toujours journalisé ;
-- * modérateur : lecture des vitrines et contenus, actions uniquement via
--   les fonctions admin_* (validation, modération), journalisées ;
-- * toute modification faite par un membre du staff est écrite dans audit_logs
--   par un trigger, même hors des fonctions admin_*.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RÔLES
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists role             public.platform_role not null default 'user',
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text check (char_length(suspended_reason) <= 500),
  add column if not exists deleted_at       timestamptz;

update public.profiles set role = 'admin' where is_platform_admin;
update public.profiles p set role = 'prestataire'
 where role = 'user' and exists (select 1 from public.vendors v where v.owner_id = p.id);

-- Rôle de l'utilisateur courant (un compte suspendu perd ses droits de staff)
create or replace function public.platform_role() returns public.platform_role
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid() and suspended_at is null and deleted_at is null),
    'user'::public.platform_role);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.platform_role() = 'admin';
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.platform_role() in ('admin', 'moderateur');
$$;

-- L'ancien drapeau est remplacé par le rôle
drop policy if exists profiles_self_update on public.profiles;
alter table public.profiles drop column if exists is_platform_admin;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_staff());

-- Rôle et suspension : uniquement par un admin (ou le serveur)
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.role is distinct from old.role then
    if public.is_admin() then
      if new.id = auth.uid() then
        raise exception 'ROLE_SELF_CHANGE' using errcode = '42501';
      end if;
    -- seule transition automatique : « user » devient « prestataire » quand il possède une vitrine
    elsif not (old.role = 'user' and new.role = 'prestataire'
               and exists (select 1 from public.vendors where owner_id = new.id)) then
      raise exception 'ROLE_ADMIN_ONLY' using errcode = '42501';
    end if;
  end if;
  if (new.suspended_at is distinct from old.suspended_at
      or new.suspended_reason is distinct from old.suspended_reason
      or new.deleted_at is distinct from old.deleted_at) and not public.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Le créateur d'une vitrine devient « prestataire »
create or replace function public.handle_new_vendor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.vendor_members (vendor_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  insert into public.subscriptions (vendor_id, plan_id) values (new.id, 'free');
  update public.profiles set role = 'prestataire' where id = new.owner_id and role = 'user';
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. VALIDATION DES VITRINES
-- ---------------------------------------------------------------------
alter table public.vendors
  add column if not exists submitted_at     timestamptz,
  add column if not exists approved_at      timestamptz,
  add column if not exists reviewed_by      uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at      timestamptz,
  add column if not exists rejection_reason text check (char_length(rejection_reason) <= 1000),
  add column if not exists suspended_reason text check (char_length(suspended_reason) <= 1000);
-- les vitrines déjà en ligne sont considérées comme validées
update public.vendors set approved_at = coalesce(published_at, now()) where status = 'published' and approved_at is null;
create index if not exists vendors_review_queue_idx on public.vendors (submitted_at) where status = 'pending_review';

-- Remplace le garde-fou S1 : champs système + circuit de validation
create or replace function public.guard_vendor_system_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.owner_id is distinct from old.owner_id then
    raise exception 'OWNER_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  -- valeurs calculées ou posées par la modération : ignorées si un prestataire tente de les changer
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
  -- changement de statut par l'équipe du prestataire
  if not public.has_vendor_role(new.id, 'manager') then
    raise exception 'PUBLISH_MANAGER_ONLY' using errcode = '42501';
  end if;
  if old.status = 'suspended' then
    raise exception 'VENDOR_SUSPENDED' using errcode = '42501';
  end if;
  if new.status not in ('draft', 'published') then
    raise exception 'STATUS_ADMIN_ONLY' using errcode = '42501';
  end if;
  -- première publication (ou nouvelle demande après refus) : passage par la file de validation
  if new.status = 'published' and old.approved_at is null then
    new.status           := 'pending_review';
    new.submitted_at     := now();
    new.published_at     := old.published_at;
    new.rejection_reason := null;
  end if;
  return new;
end $$;

drop policy if exists vendors_read on public.vendors;
create policy vendors_read on public.vendors for select
  using (status = 'published' or owner_id = auth.uid() or public.has_vendor_role(id) or public.is_staff());

-- Lecture des contenus par le staff (aperçu de la file de validation, modération)
create policy vcat_staff_read     on public.vendor_categories for select using (public.is_staff());
create policy albums_staff_read   on public.albums            for select using (public.is_staff());
create policy stories_staff_read  on public.stories           for select using (public.is_staff());
create policy packages_staff_read on public.packages          for select using (public.is_staff());
create policy options_staff_read  on public.package_options   for select using (public.is_staff());
create policy members_staff_read  on public.vendor_members    for select using (public.is_staff());
create policy subs_staff_read     on public.subscriptions     for select using (public.is_staff());

-- ---------------------------------------------------------------------
-- 3. MODÉRATION (médias, avis, signalements)
-- ---------------------------------------------------------------------
-- Motifs prédéfinis (identiques côté interface)
create or replace function public.moderation_reason_ok(r text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(r, '') in ('inapproprie', 'nudite', 'violence', 'droits_auteur', 'faux_avis', 'spam',
               'arnaque', 'hors_sujet', 'informations_fausses', 'doublon', 'qualite', 'autre');
$$;

alter table public.media
  add column if not exists is_hidden     boolean not null default false,
  add column if not exists hidden_reason text,
  add column if not exists moderated_by  uuid references public.profiles (id) on delete set null,
  add column if not exists moderated_at  timestamptz;
alter table public.reviews
  add column if not exists hidden_reason text,
  add column if not exists moderated_by  uuid references public.profiles (id) on delete set null,
  add column if not exists moderated_at  timestamptz;

drop policy if exists media_read on public.media;
create policy media_read on public.media for select
  using ((status = 'ready' and not is_hidden and public.vendor_is_public(vendor_id))
         or public.has_vendor_role(vendor_id) or public.is_staff());
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select
  using ((status = 'published' and public.vendor_is_public(vendor_id)) or public.has_vendor_role(vendor_id) or public.is_staff());

-- Un prestataire ne peut pas annuler une décision de modération
create or replace function public.guard_media_moderation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() or coalesce(auth.role(), '') = 'service_role' then return new; end if;
  if new.is_hidden is distinct from old.is_hidden or new.hidden_reason is distinct from old.hidden_reason
     or new.moderated_by is distinct from old.moderated_by or new.moderated_at is distinct from old.moderated_at then
    raise exception 'MODERATION_STAFF_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists media_guard_moderation on public.media;
create trigger media_guard_moderation before update on public.media
  for each row execute function public.guard_media_moderation();

-- Avis : statut et motif modifiables par le staff uniquement (le prestataire ne fait que répondre)
create or replace function public.guard_review_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and coalesce(auth.role(), '') <> 'service_role' and (
       new.rating is distinct from old.rating or new.body is distinct from old.body
    or new.author_names is distinct from old.author_names or new.status is distinct from old.status
    or new.is_verified is distinct from old.is_verified or new.vendor_id is distinct from old.vendor_id
    or new.inquiry_id is distinct from old.inquiry_id or new.photo_path is distinct from old.photo_path
    or new.wedding_date is distinct from old.wedding_date or new.created_at is distinct from old.created_at
    or new.hidden_reason is distinct from old.hidden_reason or new.moderated_by is distinct from old.moderated_by
    or new.moderated_at is distinct from old.moderated_at) then
    raise exception 'REVIEW_READ_ONLY' using errcode = '42501';
  end if;
  if new.reply is distinct from old.reply then new.replied_at := case when new.reply is null then null else now() end; end if;
  return new;
end $$;

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  target_type      public.report_target not null,
  target_id        uuid not null,
  vendor_id        uuid references public.vendors (id) on delete cascade,
  reason           text not null check (public.moderation_reason_ok(reason)),
  details          text check (char_length(details) <= 1000),
  reporter_id      uuid references public.profiles (id) on delete set null,
  reporter_contact text check (char_length(reporter_contact) <= 200),
  reporter_visitor text check (char_length(reporter_visitor) <= 64),
  status           public.report_status not null default 'open',
  resolution       text check (char_length(resolution) <= 1000),
  handled_by       uuid references public.profiles (id) on delete set null,
  handled_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index reports_open_idx on public.reports (target_type, created_at desc) where status = 'open';
create index reports_target_idx on public.reports (target_type, target_id);
alter table public.reports enable row level security;
create policy reports_staff_read on public.reports for select using (public.is_staff());
-- création uniquement via report_content() ; traitement via admin_moderate()

-- ---------------------------------------------------------------------
-- 4. MISE EN AVANT DE L'ACCUEIL
-- ---------------------------------------------------------------------
create table public.featured_slides (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  media_id    uuid references public.media (id) on delete set null,   -- photo/vidéo de la vitrine
  image_path  text,                                                   -- ou visuel dédié (bucket site-media)
  title       text check (char_length(title) <= 120),
  subtitle    text check (char_length(subtitle) <= 200),
  sort        integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (media_id is not null or image_path is not null)
);

create table public.home_picks (
  id          uuid primary key default gen_random_uuid(),
  section     text not null check (section in ('recommandations', 'a_la_une')),
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  sort        integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (section, vendor_id)
);
-- un seul prestataire « à la une »
create unique index home_picks_one_spotlight on public.home_picks (section) where section = 'a_la_une';

create table public.featured_stories (
  story_id    uuid primary key references public.stories (id) on delete cascade,
  sort        integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.featured_slides  enable row level security;
alter table public.home_picks       enable row level security;
alter table public.featured_stories enable row level security;

-- Lecture publique : uniquement ce qui est actif, dans sa période, et lié à une vitrine publiée
create policy slides_public_read on public.featured_slides for select using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
   and public.vendor_is_public(vendor_id)) or public.is_staff());
create policy picks_public_read on public.home_picks for select using (
  ((starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
   and public.vendor_is_public(vendor_id)) or public.is_staff());
create policy fstories_public_read on public.featured_stories for select using (
  ((starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
   and exists (select 1 from public.stories s where s.id = story_id and not s.is_archived
               and public.vendor_is_public(s.vendor_id))) or public.is_staff());
create policy slides_admin   on public.featured_slides  for all using (public.is_admin()) with check (public.is_admin());
create policy picks_admin    on public.home_picks       for all using (public.is_admin()) with check (public.is_admin());
create policy fstories_admin on public.featured_stories for all using (public.is_admin()) with check (public.is_admin());

-- Le badge « Recommandé » suit la liste « Nos recommandations »
create or replace function public.sync_recommended() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.section = 'recommandations' then
    update public.vendors set is_recommended = true where id = new.vendor_id and not is_recommended;
  end if;
  if tg_op in ('DELETE', 'UPDATE') and old.section = 'recommandations'
     and not exists (select 1 from public.home_picks where section = 'recommandations' and vendor_id = old.vendor_id) then
    update public.vendors set is_recommended = false where id = old.vendor_id and is_recommended;
  end if;
  return null;
end $$;
create trigger home_picks_sync after insert or update or delete on public.home_picks
  for each row execute function public.sync_recommended();

-- Visuels de l'accueil (hero) : lecture publique, écriture admin
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('site-media', 'site-media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
on conflict (id) do nothing;
create policy site_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());
create policy site_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
create policy site_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());

-- ---------------------------------------------------------------------
-- 5. CATÉGORIES ET VILLES
-- ---------------------------------------------------------------------
alter table public.categories
  add column if not exists image_path text,
  add column if not exists is_active  boolean not null default true;

create table public.cities (
  id         smallint generated always as identity primary key,
  name       text not null unique check (char_length(name) between 2 and 60),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  province   text,
  sort       smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cities enable row level security;
create policy cities_read  on public.cities for select using (is_active or public.is_staff());
create policy cities_admin on public.cities for all using (public.is_admin()) with check (public.is_admin());
insert into public.cities (name, slug, province, sort) values
  ('Kinshasa', 'kinshasa', 'Kinshasa', 1), ('Lubumbashi', 'lubumbashi', 'Haut-Katanga', 2),
  ('Goma', 'goma', 'Nord-Kivu', 3), ('Matadi', 'matadi', 'Kongo-Central', 4),
  ('Bukavu', 'bukavu', 'Sud-Kivu', 5), ('Kisangani', 'kisangani', 'Tshopo', 6),
  ('Mbuji-Mayi', 'mbuji-mayi', 'Kasaï-Oriental', 7), ('Kolwezi', 'kolwezi', 'Lualaba', 8),
  ('Boma', 'boma', 'Kongo-Central', 9), ('Kananga', 'kananga', 'Kasaï-Central', 10)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------
-- 6. OFFRES, ABONNEMENTS, PAIEMENTS
-- ---------------------------------------------------------------------
alter table public.plans
  add column if not exists features   text[] not null default '{}',   -- avantages affichés
  add column if not exists is_active  boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();
alter table public.invoices
  add column if not exists refunded_at   timestamptz,
  add column if not exists refund_amount bigint check (refund_amount >= 0),
  add column if not exists refund_reason text check (char_length(refund_reason) <= 500),
  add column if not exists refunded_by   uuid references public.profiles (id) on delete set null;
create policy invoices_staff_read on public.invoices for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7. COMMUNICATION (annonces, e-mails sortants)
-- ---------------------------------------------------------------------
create table public.announcements (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 3 and 120),
  body             text not null check (char_length(body) between 3 and 5000),
  channels         text[] not null default '{in_app}' check (channels <@ array['in_app', 'email'] and cardinality(channels) > 0),
  -- filtres : { "plans": ["pro"], "cities": ["Goma"], "categories": ["dj"], "statuses": ["published"] } ; vide = tous
  audience         jsonb not null default '{}'::jsonb,
  status           text not null default 'draft' check (status in ('draft', 'sent')),
  recipients_count integer,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);
alter table public.announcements enable row level security;
create policy announcements_admin on public.announcements for all using (public.is_admin()) with check (public.is_admin());

-- File d'envoi des e-mails (traitée côté serveur par une Edge Function avec le fournisseur SMTP)
create table public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  to_email    citext not null,
  to_user     uuid references public.profiles (id) on delete set null,
  template    text not null,            -- vendor_rejected, vendor_approved, announcement…
  subject     text not null,
  body        text not null,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error       text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
alter table public.email_outbox enable row level security;
create policy outbox_admin_read on public.email_outbox for select using (public.is_admin());

-- ---------------------------------------------------------------------
-- 8. PAGES ET CONTENUS
-- ---------------------------------------------------------------------
create table public.site_pages (
  slug         text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null check (char_length(title) between 2 and 120),
  body         text not null default '',          -- Markdown
  is_published boolean not null default false,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);
create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  audience     text not null default 'couples' check (audience in ('couples', 'prestataires')),
  question     text not null check (char_length(question) between 5 and 300),
  answer       text not null check (char_length(answer) between 2 and 3000),
  sort         integer not null default 0,
  is_published boolean not null default true,
  updated_at   timestamptz not null default now()
);
create table public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  is_public   boolean not null default false,       -- lisible par le site public (textes de l'accueil…)
  updated_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.site_pages    enable row level security;
alter table public.faqs          enable row level security;
alter table public.site_settings enable row level security;
create policy pages_read     on public.site_pages    for select using (is_published or public.is_staff());
create policy pages_admin    on public.site_pages    for all using (public.is_admin()) with check (public.is_admin());
create policy faqs_read      on public.faqs          for select using (is_published or public.is_staff());
create policy faqs_admin     on public.faqs          for all using (public.is_admin()) with check (public.is_admin());
create policy settings_read  on public.site_settings for select using (is_public or public.is_staff());
create policy settings_admin on public.site_settings for all using (public.is_admin()) with check (public.is_admin());

insert into public.site_pages (slug, title) values
  ('cgu', 'Conditions d’utilisation'), ('confidentialite', 'Politique de confidentialité'),
  ('mentions-legales', 'Mentions légales')
on conflict (slug) do nothing;
insert into public.site_settings (key, value, is_public) values
  ('accueil.hero', '{"titre": "", "sous_titre": ""}', true),   -- vide : textes par défaut du site
  ('general.contact', '{"email": "bonjour@ndoa.cd", "whatsapp": ""}', true),
  ('moderation.validation_obligatoire', 'true', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 9. JOURNAL D'AUDIT
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  public.platform_role,
  action      text not null,                  -- vendor.approve, media.hide, vendors.update…
  target_type text not null,
  target_id   text,
  vendor_id   uuid,                           -- sans clé étrangère : l'historique survit à la suppression
  reason      text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_logs_time_idx   on public.audit_logs (created_at desc);
create index audit_logs_actor_idx  on public.audit_logs (actor_id, created_at desc);
create index audit_logs_target_idx on public.audit_logs (target_type, target_id);
alter table public.audit_logs enable row level security;
-- lecture : admin ; écriture : uniquement par les fonctions et triggers ci-dessous ; jamais modifiable
create policy audit_admin_read on public.audit_logs for select using (public.is_admin());
revoke insert, update, delete, truncate on public.audit_logs from anon, authenticated;

-- Toute modification faite par le staff est journalisée (y compris en dehors des fonctions admin_*).
-- Les fonctions admin_* précisent l'action et le motif via ndoa.audit_action / ndoa.audit_reason.
-- Les effets en cascade (suppression d'une vitrine → ses médias) ne sont pas re-journalisés.
create or replace function public.audit_staff_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec  jsonb;
  prev jsonb;
  diff jsonb;
  tid  text;
  vid  uuid;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or not public.is_staff() then return null; end if;
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op = 'UPDATE' then
    prev := to_jsonb(old);
    select coalesce(jsonb_object_agg(n.key, jsonb_build_array(prev -> n.key, n.value)), '{}'::jsonb) into diff
      from jsonb_each(rec) n
     where n.key <> 'updated_at' and (prev -> n.key) is distinct from n.value;
    if diff = '{}'::jsonb then return null; end if;
  elsif tg_op = 'DELETE' and tg_table_name = 'profiles' then
    diff := jsonb_build_object('id', rec -> 'id');   -- données personnelles non conservées
  else
    diff := rec;
  end if;
  tid := coalesce(rec ->> 'id', rec ->> 'slug', rec ->> 'key', rec ->> 'story_id', rec ->> 'vendor_id');
  vid := case when tg_table_name = 'vendors' then (rec ->> 'id')::uuid else nullif(rec ->> 'vendor_id', '')::uuid end;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, vendor_id, reason, details)
  values (auth.uid(), public.platform_role(),
          coalesce(nullif(current_setting('ndoa.audit_action', true), ''), tg_table_name || '.' || lower(tg_op)),
          tg_table_name, tid, vid, nullif(current_setting('ndoa.audit_reason', true), ''), diff);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['vendors', 'media', 'reviews', 'stories', 'categories', 'cities', 'plans', 'profiles',
                           'subscriptions', 'invoices', 'featured_slides', 'home_picks', 'featured_stories',
                           'site_pages', 'faqs', 'site_settings', 'reports', 'announcements', 'vendor_members']
  loop
    execute format('drop trigger if exists zz_audit on public.%I', t);
    execute format('create trigger zz_audit after insert or update or delete on public.%I
                    for each row execute function public.audit_staff_change()', t);
  end loop;
end $$;
