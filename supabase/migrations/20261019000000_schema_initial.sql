-- =====================================================================
-- Éclat — Espace prestataire : schéma initial
-- Cible : Supabase (Postgres 15+). À appliquer avec `supabase db push`.
-- Conventions : snake_case, uuid partout, montants en centimes (bigint),
-- horodatages en timestamptz, RLS activée sur TOUTES les tables publiques.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;  -- déjà présent sur Supabase
create extension if not exists citext with schema public;  -- opérateurs visibles des fonctions (search_path = public)

-- ---------------------------------------------------------------------
-- 1. TYPES
-- ---------------------------------------------------------------------
create type public.vendor_status       as enum ('draft', 'published', 'suspended');
create type public.member_role         as enum ('owner', 'manager', 'editor', 'viewer');
create type public.member_status       as enum ('invited', 'active', 'revoked');
create type public.media_kind          as enum ('photo', 'video');
create type public.media_status        as enum ('uploading', 'processing', 'ready', 'failed');
create type public.album_kind          as enum ('wedding', 'theme');
create type public.currency_code       as enum ('USD', 'CDF');
create type public.price_mode          as enum ('fixed', 'from');
create type public.promo_kind          as enum ('seasonal', 'limited');
create type public.discount_kind       as enum ('percent', 'amount', 'override');
create type public.inquiry_status      as enum ('new', 'discussing', 'quote_sent', 'confirmed', 'lost');
create type public.sender_kind         as enum ('vendor', 'couple', 'system');
create type public.quote_status        as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type public.availability_status as enum ('booked', 'blocked', 'option');
create type public.review_status       as enum ('pending', 'published', 'hidden');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');
create type public.payment_method      as enum ('mpesa', 'orange_money', 'airtel_money', 'card');
create type public.invoice_status      as enum ('pending', 'paid', 'failed', 'refunded');
create type public.analytics_event     as enum ('profile_view', 'whatsapp_click', 'call_click', 'quote_request', 'photo_view', 'follow', 'share');
create type public.notif_channel       as enum ('in_app', 'email', 'sms', 'whatsapp');

-- ---------------------------------------------------------------------
-- 2. COMPTES
-- ---------------------------------------------------------------------
-- Un profil par utilisateur Supabase Auth (prestataire, membre d'équipe,
-- marié ou administrateur plateforme).
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  phone              text,
  avatar_path        text,
  locale             text not null default 'fr' check (locale in ('fr', 'en', 'ln', 'sw')),
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CATALOGUE
-- ---------------------------------------------------------------------
create table public.categories (
  id           smallint generated always as identity primary key,
  slug         text not null unique,
  name         text not null,            -- « Photographe »
  name_plural  text not null,            -- « Photographes »
  icon         text,
  -- champs spécifiques affichés dans « Ma vitrine » (matériel, capacité…)
  detail_schema jsonb not null default '[]'::jsonb,
  sort         smallint not null default 0
);

create table public.plans (
  id          text primary key check (id in ('free', 'pro', 'prestige')),
  name        text not null,
  price_usd   integer not null default 0,     -- en centimes / mois
  price_cdf   bigint  not null default 0,     -- en francs / mois (fixé par l'admin)
  -- { max_photos, max_videos, storage_mb, max_video_mb, max_packages,
  --   team_seats, stats: "basic"|"advanced", verified_badge, recommendation_eligible }
  limits      jsonb not null,
  sort        smallint not null default 0
);

-- ---------------------------------------------------------------------
-- 4. PRESTATAIRES
-- ---------------------------------------------------------------------
create table public.vendors (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references public.profiles (id) on delete restrict,
  slug                 citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name                 text not null check (char_length(name) between 2 and 80),
  tagline              text check (char_length(tagline) <= 120),
  bio                  text check (char_length(bio) <= 3000),
  style_tags           text[] not null default '{}',
  city                 text not null,
  zones                text[] not null default '{}',
  languages            text[] not null default '{fr}',
  avatar_path          text,
  cover_media_id       uuid,                          -- FK ajoutée après « media »
  phone                text,
  whatsapp             text,
  email                citext,
  socials              jsonb not null default '{}'::jsonb,   -- { instagram, tiktok, facebook, youtube, site }
  details              jsonb not null default '{}'::jsonb,   -- matériel, capacité, parking…
  status               public.vendor_status not null default 'draft',
  onboarding_step      smallint not null default 1 check (onboarding_step between 1 and 7),
  is_verified          boolean not null default false,       -- posé par l'admin / l'offre
  is_recommended       boolean not null default false,       -- « Nos recommandations »
  rating_avg           numeric(2, 1) not null default 0,
  rating_count         integer not null default 0,
  followers_count      integer not null default 0,
  response_minutes     integer,                              -- temps de réponse médian
  published_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index vendors_city_idx   on public.vendors (city) where status = 'published';
create index vendors_status_idx on public.vendors (status);

create table public.vendor_categories (
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  is_primary  boolean not null default false,
  primary key (vendor_id, category_id)
);
create unique index vendor_one_primary_category on public.vendor_categories (vendor_id) where is_primary;

create table public.vendor_members (
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete cascade,
  invited_email citext,
  role          public.member_role not null default 'editor',
  status        public.member_status not null default 'invited',
  invited_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  id            uuid primary key default gen_random_uuid(),
  unique (vendor_id, user_id),
  check (user_id is not null or invited_email is not null)
);
create index vendor_members_user_idx on public.vendor_members (user_id) where status = 'active';

-- ---------------------------------------------------------------------
-- 5. MÉDIAS, ALBUMS, STORIES
-- ---------------------------------------------------------------------
create table public.albums (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 80),
  kind           public.album_kind not null default 'wedding',
  wedding_date   date,
  cover_media_id uuid,
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);
create index albums_vendor_idx on public.albums (vendor_id, sort);

create table public.media (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  album_id      uuid references public.albums (id) on delete set null,
  kind          public.media_kind not null,
  storage_path  text not null unique,           -- vendor-media/{vendor_id}/{uuid}.webp
  poster_path   text,                           -- vignette des vidéos
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  width         integer,
  height        integer,
  duration_s    numeric(6, 2),
  blurhash      text,
  alt           text check (char_length(alt) <= 200),
  is_featured   boolean not null default false,  -- « à la une »
  sort          integer not null default 0,
  status        public.media_status not null default 'uploading',
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  check (
    (kind = 'photo' and mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif'))
    or (kind = 'video' and mime_type in ('video/mp4', 'video/webm', 'video/quicktime'))
  )
);
create index media_vendor_idx on public.media (vendor_id, album_id, sort);
create index media_featured_idx on public.media (vendor_id) where is_featured;

alter table public.vendors add constraint vendors_cover_fk
  foreign key (cover_media_id) references public.media (id) on delete set null;
alter table public.albums add constraint albums_cover_fk
  foreign key (cover_media_id) references public.media (id) on delete set null;

-- Highlights (permanents) et stories (éphémères : expires_at renseigné)
create table public.stories (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  title          text not null check (char_length(title) between 1 and 24),
  cover_media_id uuid references public.media (id) on delete set null,
  expires_at     timestamptz,          -- null = highlight permanent
  is_archived    boolean not null default false,
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);
create table public.story_items (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references public.stories (id) on delete cascade,
  media_id    uuid not null references public.media (id) on delete cascade,
  caption     text check (char_length(caption) <= 140),
  duration_ms integer not null default 5000 check (duration_ms between 2000 and 15000),
  sort        integer not null default 0
);

-- ---------------------------------------------------------------------
-- 6. TARIFS
-- ---------------------------------------------------------------------
create table public.packages (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 40),
  description    text check (char_length(description) <= 400),
  price_mode     public.price_mode not null default 'from',
  price_amount   bigint not null check (price_amount >= 0),   -- centimes (USD) ou francs (CDF)
  currency       public.currency_code not null default 'USD',
  duration_label text,                                        -- « 10 h », « Journée complète »
  includes       text[] not null default '{}',
  excludes       text[] not null default '{}',
  is_featured    boolean not null default false,              -- « Le plus populaire »
  is_visible     boolean not null default true,
  sort           integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index packages_one_featured on public.packages (vendor_id) where is_featured;

create table public.package_options (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id) on delete cascade,
  package_id   uuid references public.packages (id) on delete cascade,  -- null = option globale
  name         text not null,
  price_amount bigint not null check (price_amount >= 0),
  currency     public.currency_code not null default 'USD',
  sort         integer not null default 0
);

create table public.promotions (
  id          uuid primary key default gen_random_uuid(),
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  package_id  uuid references public.packages (id) on delete cascade,     -- null = tous les forfaits
  kind        public.promo_kind not null,
  label       text not null,                                            -- « Saison sèche », « -15 % jusqu'au 30/11 »
  discount    public.discount_kind not null,
  value       bigint not null check (value > 0),
  starts_at   date not null,
  ends_at     date not null,
  check (ends_at >= starts_at)
);

-- ---------------------------------------------------------------------
-- 7. DEMANDES, MESSAGES, DEVIS
-- ---------------------------------------------------------------------
create table public.inquiries (
  id              uuid primary key default gen_random_uuid(),
  vendor_id       uuid not null references public.vendors (id) on delete cascade,
  couple_user_id  uuid references public.profiles (id) on delete set null,
  couple_names    text not null,
  email           citext,
  phone           text,
  contact_pref    text check (contact_pref in ('whatsapp', 'call', 'email')),
  wedding_date    date,
  city            text,
  venue           text,
  guests          integer check (guests between 1 and 5000),
  package_id      uuid references public.packages (id) on delete set null,
  option_ids      uuid[] not null default '{}',
  budget_amount   bigint,
  currency        public.currency_code not null default 'USD',
  message         text check (char_length(message) <= 3000),
  source          text,                     -- profil, story, recommandation, partage…
  status          public.inquiry_status not null default 'new',
  lost_reason     text,
  assigned_to     uuid references public.profiles (id) on delete set null,
  unread_vendor   integer not null default 1,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create index inquiries_vendor_status_idx on public.inquiries (vendor_id, status, last_message_at desc);

create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  inquiry_id   uuid not null references public.inquiries (id) on delete cascade,
  sender       public.sender_kind not null,
  sender_id    uuid references public.profiles (id) on delete set null,
  body         text check (char_length(body) <= 4000),
  attachments  jsonb not null default '[]'::jsonb,   -- [{ path, name, mime, size }]
  quote_id     uuid,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (body is not null or jsonb_array_length(attachments) > 0 or quote_id is not null)
);
create index messages_inquiry_idx on public.messages (inquiry_id, created_at);

create table public.quick_replies (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  title      text not null,
  body       text not null check (char_length(body) <= 2000),
  sort       integer not null default 0
);

create table public.quotes (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null references public.vendors (id) on delete cascade,
  inquiry_id   uuid not null references public.inquiries (id) on delete cascade,
  number       text not null,                    -- ECL-2026-0042
  package_id   uuid references public.packages (id) on delete set null,
  items        jsonb not null,                   -- [{ label, qty, unit_amount }]
  discount     bigint not null default 0,
  total        bigint not null check (total >= 0),
  currency     public.currency_code not null,
  valid_until  date not null,
  notes        text,
  pdf_path     text,                             -- vendor-private/{vendor_id}/quotes/{id}.pdf
  status       public.quote_status not null default 'draft',
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (vendor_id, number)
);
alter table public.messages add constraint messages_quote_fk
  foreign key (quote_id) references public.quotes (id) on delete set null;

-- ---------------------------------------------------------------------
-- 8. DISPONIBILITÉS
-- ---------------------------------------------------------------------
create table public.availability (
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  day         date not null,
  status      public.availability_status not null,
  inquiry_id  uuid references public.inquiries (id) on delete set null,
  note        text,                                  -- privé, jamais exposé au public
  primary key (vendor_id, day)
);

-- ---------------------------------------------------------------------
-- 9. AVIS
-- ---------------------------------------------------------------------
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  inquiry_id     uuid references public.inquiries (id) on delete set null,
  author_names   text not null,
  photo_path     text,
  wedding_date   date,
  city           text,
  rating         smallint not null check (rating between 1 and 5),
  body           text not null check (char_length(body) between 20 and 2000),
  reply          text check (char_length(reply) <= 1000),
  replied_at     timestamptz,
  status         public.review_status not null default 'pending',
  is_verified    boolean not null default false,   -- lié à une demande confirmée
  created_at     timestamptz not null default now()
);
create index reviews_vendor_idx on public.reviews (vendor_id, status, created_at desc);

create table public.review_requests (
  token       text primary key default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  inquiry_id  uuid references public.inquiries (id) on delete set null,
  sent_to     text,
  expires_at  timestamptz not null default now() + interval '60 days',
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 10. AUDIENCE ET STATISTIQUES
-- ---------------------------------------------------------------------
create table public.followers (
  vendor_id  uuid not null references public.vendors (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vendor_id, user_id)
);

-- Événements bruts (écrits uniquement côté serveur, purgés après 13 mois)
create table public.analytics_events (
  id          bigint generated always as identity primary key,
  vendor_id   uuid not null references public.vendors (id) on delete cascade,
  event       public.analytics_event not null,
  source      text,               -- recherche, accueil, recommandations, instagram, direct…
  media_id    uuid references public.media (id) on delete set null,
  visitor_id  text,               -- identifiant anonyme haché, pour dédoublonner
  created_at  timestamptz not null default now()
);
create index analytics_vendor_time_idx on public.analytics_events (vendor_id, created_at);

-- Agrégats quotidiens lus par le tableau de bord (remplis par pg_cron)
create table public.vendor_stats_daily (
  vendor_id        uuid not null references public.vendors (id) on delete cascade,
  day              date not null,
  views            integer not null default 0,
  whatsapp_clicks  integer not null default 0,
  call_clicks      integer not null default 0,
  quote_requests   integer not null default 0,
  photo_views      integer not null default 0,
  new_followers    integer not null default 0,
  sources          jsonb not null default '{}'::jsonb,   -- { recherche: 120, instagram: 40 }
  primary key (vendor_id, day)
);

-- ---------------------------------------------------------------------
-- 11. ABONNEMENT ET FACTURATION
-- ---------------------------------------------------------------------
create table public.subscriptions (
  vendor_id           uuid primary key references public.vendors (id) on delete cascade,
  plan_id             text not null references public.plans (id) default 'free',
  status              public.subscription_status not null default 'active',
  billing_currency    public.currency_code not null default 'USD',
  current_period_end  timestamptz,
  cancel_at_period_end boolean not null default false,
  provider            text,             -- agrégateur Mobile Money / carte
  provider_ref        text,
  updated_at          timestamptz not null default now()
);

create table public.invoices (
  id            uuid primary key default gen_random_uuid(),
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  number        text not null unique,          -- FAC-2026-000123
  plan_id       text not null references public.plans (id),
  amount        bigint not null check (amount >= 0),
  currency      public.currency_code not null,
  method        public.payment_method not null,
  status        public.invoice_status not null default 'pending',
  provider_ref  text,
  period_start  date not null,
  period_end    date not null,
  pdf_path      text,
  paid_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index invoices_vendor_idx on public.invoices (vendor_id, created_at desc);

-- ---------------------------------------------------------------------
-- 12. NOTIFICATIONS
-- ---------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  vendor_id   uuid references public.vendors (id) on delete cascade,
  type        text not null,          -- new_inquiry, new_message, new_review, quota_80, payment_failed…
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.notification_prefs (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  type     text not null,
  channel  public.notif_channel not null,
  enabled  boolean not null default true,
  primary key (user_id, type, channel)
);

-- =====================================================================
-- 13. FONCTIONS UTILITAIRES (SECURITY DEFINER, search_path figé)
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.role_rank(r public.member_role) returns int
language sql immutable as $$
  select case r when 'owner' then 4 when 'manager' then 3 when 'editor' then 2 else 1 end;
$$;

-- Vrai si l'utilisateur courant a au moins le rôle `min_role` sur le prestataire.
create or replace function public.has_vendor_role(v uuid, min_role public.member_role default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.vendor_members m
    where m.vendor_id = v and m.user_id = auth.uid() and m.status = 'active'
      and public.role_rank(m.role) >= public.role_rank(min_role)
  );
$$;

create or replace function public.vendor_is_public(v uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vendors where id = v and status = 'published');
$$;

-- Limites de l'offre active (offre gratuite par défaut)
create or replace function public.vendor_limits(v uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.limits from public.subscriptions s join public.plans p on p.id = s.plan_id
      where s.vendor_id = v and s.status in ('trialing', 'active')),
    (select limits from public.plans where id = 'free')
  );
$$;

-- Score de complétude (0–100), affiché dans l'onboarding et le tableau de bord
create or replace function public.vendor_completeness(v uuid) returns int
language sql stable security definer set search_path = public as $$
  select (
      (case when x.avatar_path is not null then 10 else 0 end)
    + (case when x.cover_media_id is not null then 10 else 0 end)
    + (case when char_length(coalesce(x.bio, '')) >= 200 then 15 else 0 end)
    + (case when exists (select 1 from public.vendor_categories c where c.vendor_id = v) then 5 else 0 end)
    + (case when cardinality(x.zones) > 0 then 5 else 0 end)
    + least(20, (select count(*) from public.media m where m.vendor_id = v and m.status = 'ready')::int * 20 / 12)
    + (case when exists (select 1 from public.packages p where p.vendor_id = v and p.is_visible) then 15 else 0 end)
    + (case when x.whatsapp is not null or x.phone is not null then 10 else 0 end)
    + (case when x.socials <> '{}'::jsonb then 5 else 0 end)
    + (case when exists (select 1 from public.stories s where s.vendor_id = v and not s.is_archived) then 5 else 0 end)
  )::int
  from public.vendors x where x.id = v;
$$;

-- =====================================================================
-- 14. TRIGGERS MÉTIER
-- =====================================================================
-- Profil créé à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Le créateur d'un prestataire en devient propriétaire + offre gratuite
create or replace function public.handle_new_vendor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.vendor_members (vendor_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active');
  insert into public.subscriptions (vendor_id, plan_id) values (new.id, 'free');
  return new;
end $$;
create trigger on_vendor_created after insert on public.vendors
  for each row execute function public.handle_new_vendor();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger vendors_touch  before update on public.vendors  for each row execute function public.touch_updated_at();
create trigger packages_touch before update on public.packages for each row execute function public.touch_updated_at();

-- Publication : conditions minimales (6 photos, 1 forfait, 1 contact, 1 catégorie)
create or replace function public.guard_vendor_publish() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if (select count(*) from public.media where vendor_id = new.id and kind = 'photo' and status = 'ready') < 6 then
      raise exception 'PUBLISH_NEEDS_6_PHOTOS' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.packages where vendor_id = new.id and is_visible) then
      raise exception 'PUBLISH_NEEDS_PACKAGE' using errcode = 'P0001';
    end if;
    if new.phone is null and new.whatsapp is null then
      raise exception 'PUBLISH_NEEDS_CONTACT' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.vendor_categories where vendor_id = new.id) then
      raise exception 'PUBLISH_NEEDS_CATEGORY' using errcode = 'P0001';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  -- seul l'admin peut changer les badges
  if (new.is_verified is distinct from old.is_verified or new.is_recommended is distinct from old.is_recommended)
     and not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'BADGES_ADMIN_ONLY' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger vendors_guard_publish before update on public.vendors
  for each row execute function public.guard_vendor_publish();

-- Quotas de l'offre : nombre de photos / vidéos, stockage, taille de fichier
create or replace function public.enforce_media_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  lim   jsonb := public.vendor_limits(new.vendor_id);
  n     int;
  total bigint;
begin
  if new.kind = 'photo' and new.size_bytes > 15 * 1024 * 1024 then
    raise exception 'FILE_TOO_LARGE' using errcode = 'P0001';
  end if;
  if new.kind = 'video' and new.size_bytes > (lim ->> 'max_video_mb')::bigint * 1024 * 1024 then
    raise exception 'FILE_TOO_LARGE' using errcode = 'P0001';
  end if;
  select count(*) into n from public.media
    where vendor_id = new.vendor_id and kind = new.kind and status <> 'failed';
  if new.kind = 'photo' and n >= (lim ->> 'max_photos')::int then
    raise exception 'QUOTA_PHOTOS' using errcode = 'P0001';
  end if;
  if new.kind = 'video' and n >= (lim ->> 'max_videos')::int then
    raise exception 'QUOTA_VIDEOS' using errcode = 'P0001';
  end if;
  select coalesce(sum(size_bytes), 0) into total from public.media
    where vendor_id = new.vendor_id and status <> 'failed';
  if total + new.size_bytes > (lim ->> 'storage_mb')::bigint * 1024 * 1024 then
    raise exception 'QUOTA_STORAGE' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger media_quota before insert on public.media
  for each row execute function public.enforce_media_quota();

-- Nombre de forfaits selon l'offre
create or replace function public.enforce_package_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim jsonb := public.vendor_limits(new.vendor_id);
begin
  if (lim ->> 'max_packages') is not null and
     (select count(*) from public.packages where vendor_id = new.vendor_id) >= (lim ->> 'max_packages')::int then
    raise exception 'QUOTA_PACKAGES' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger packages_quota before insert on public.packages
  for each row execute function public.enforce_package_quota();

-- Nouveau message : horodatage, compteur de non-lus, notification in-app
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare i public.inquiries;
begin
  update public.inquiries
     set last_message_at = new.created_at,
         unread_vendor = unread_vendor + case when new.sender = 'couple' then 1 else 0 end,
         status = case when status = 'new' and new.sender = 'vendor' then 'discussing' else status end
   where id = new.inquiry_id
  returning * into i;
  if new.sender = 'couple' then
    insert into public.notifications (user_id, vendor_id, type, title, body, link)
    select m.user_id, i.vendor_id, 'new_message', 'Nouveau message de ' || i.couple_names,
           left(new.body, 140), '/espace/demandes/' || i.id
      from public.vendor_members m
     where m.vendor_id = i.vendor_id and m.status = 'active' and m.user_id is not null;
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- Nouvelle demande : notification à toute l'équipe
create or replace function public.on_inquiry_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, vendor_id, type, title, body, link)
  select m.user_id, new.vendor_id, 'new_inquiry', 'Nouvelle demande de devis',
         new.couple_names || coalesce(' · ' || to_char(new.wedding_date, 'DD/MM/YYYY'), ''),
         '/espace/demandes/' || new.id
    from public.vendor_members m
   where m.vendor_id = new.vendor_id and m.status = 'active' and m.user_id is not null;
  return new;
end $$;
create trigger inquiries_after_insert after insert on public.inquiries
  for each row execute function public.on_inquiry_insert();

-- Statut de demande → calendrier (synchronisé avec la page publique)
create or replace function public.sync_availability() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.wedding_date is null then return new; end if;
  if new.status = 'confirmed' then
    insert into public.availability (vendor_id, day, status, inquiry_id)
    values (new.vendor_id, new.wedding_date, 'booked', new.id)
    on conflict (vendor_id, day) do update set status = 'booked', inquiry_id = excluded.inquiry_id;
  elsif new.status = 'quote_sent' then
    insert into public.availability (vendor_id, day, status, inquiry_id)
    values (new.vendor_id, new.wedding_date, 'option', new.id)
    on conflict (vendor_id, day) do nothing;
  elsif new.status = 'lost' then
    delete from public.availability
     where vendor_id = new.vendor_id and day = new.wedding_date and inquiry_id = new.id;
  end if;
  return new;
end $$;
create trigger inquiries_sync_availability after update of status on public.inquiries
  for each row when (old.status is distinct from new.status)
  execute function public.sync_availability();

-- Note moyenne recalculée à chaque changement d'avis
create or replace function public.refresh_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  update public.vendors set
    rating_avg   = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where vendor_id = v and status = 'published'), 0),
    rating_count = (select count(*) from public.reviews where vendor_id = v and status = 'published')
  where id = v;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_rating();

-- =====================================================================
-- 15. SÉCURITÉ : RLS
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.plans               enable row level security;
alter table public.vendors             enable row level security;
alter table public.vendor_categories   enable row level security;
alter table public.vendor_members      enable row level security;
alter table public.albums              enable row level security;
alter table public.media               enable row level security;
alter table public.stories             enable row level security;
alter table public.story_items         enable row level security;
alter table public.packages            enable row level security;
alter table public.package_options     enable row level security;
alter table public.promotions          enable row level security;
alter table public.inquiries           enable row level security;
alter table public.messages            enable row level security;
alter table public.quick_replies       enable row level security;
alter table public.quotes              enable row level security;
alter table public.availability        enable row level security;
alter table public.reviews             enable row level security;
alter table public.review_requests     enable row level security;
alter table public.followers           enable row level security;
alter table public.analytics_events    enable row level security;
alter table public.vendor_stats_daily  enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.invoices            enable row level security;
alter table public.notifications       enable row level security;
alter table public.notification_prefs  enable row level security;

-- Profils : chacun lit/modifie le sien ; l'admin lit tout
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid())
  -- impossible de s'auto-promouvoir administrateur (is_admin() contourne la RLS, pas de récursion)
  with check (id = auth.uid() and is_platform_admin = public.is_admin());

-- Référentiels en lecture publique, écriture admin
create policy categories_read  on public.categories for select using (true);
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy plans_read       on public.plans      for select using (true);
create policy plans_admin      on public.plans      for all using (public.is_admin()) with check (public.is_admin());

-- Prestataires : public si publié ; équipe sinon
create policy vendors_read   on public.vendors for select using (status = 'published' or public.has_vendor_role(id));
create policy vendors_insert on public.vendors for insert to authenticated with check (owner_id = auth.uid());
create policy vendors_update on public.vendors for update using (public.has_vendor_role(id, 'editor'))
  with check (public.has_vendor_role(id, 'editor'));
create policy vendors_delete on public.vendors for delete using (public.has_vendor_role(id, 'owner'));

create policy vcat_read  on public.vendor_categories for select using (public.vendor_is_public(vendor_id) or public.has_vendor_role(vendor_id));
create policy vcat_write on public.vendor_categories for all using (public.has_vendor_role(vendor_id, 'editor'))
  with check (public.has_vendor_role(vendor_id, 'editor'));

-- Équipe : visible par l'équipe ; gérée par owner/manager ; l'owner ne peut pas être retiré ici
create policy members_read  on public.vendor_members for select using (public.has_vendor_role(vendor_id) or user_id = auth.uid());
create policy members_write on public.vendor_members for all using (public.has_vendor_role(vendor_id, 'manager') and role <> 'owner')
  with check (public.has_vendor_role(vendor_id, 'manager') and role <> 'owner');

-- Contenus de vitrine : lecture publique si prestataire publié, écriture « editor »
create policy albums_read   on public.albums for select using (public.vendor_is_public(vendor_id) or public.has_vendor_role(vendor_id));
create policy albums_write  on public.albums for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy media_read    on public.media  for select using ((status = 'ready' and public.vendor_is_public(vendor_id)) or public.has_vendor_role(vendor_id));
create policy media_write   on public.media  for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy stories_read  on public.stories for select using ((not is_archived and (expires_at is null or expires_at > now()) and public.vendor_is_public(vendor_id)) or public.has_vendor_role(vendor_id));
create policy stories_write on public.stories for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy sitems_read   on public.story_items for select using (exists (select 1 from public.stories s where s.id = story_id));
create policy sitems_write  on public.story_items for all
  using (exists (select 1 from public.stories s where s.id = story_id and public.has_vendor_role(s.vendor_id, 'editor')))
  with check (exists (select 1 from public.stories s where s.id = story_id and public.has_vendor_role(s.vendor_id, 'editor')));

create policy packages_read  on public.packages for select using ((is_visible and public.vendor_is_public(vendor_id)) or public.has_vendor_role(vendor_id));
create policy packages_write on public.packages for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy options_read   on public.package_options for select using (public.vendor_is_public(vendor_id) or public.has_vendor_role(vendor_id));
create policy options_write  on public.package_options for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy promos_read    on public.promotions for select using ((public.vendor_is_public(vendor_id) and current_date between starts_at and ends_at) or public.has_vendor_role(vendor_id));
create policy promos_write   on public.promotions for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));

-- Demandes : créées par le serveur (service role, captcha + limitation de débit) ;
-- lues par l'équipe et par le marié connecté qui l'a envoyée.
create policy inquiries_read   on public.inquiries for select using (public.has_vendor_role(vendor_id) or couple_user_id = auth.uid());
create policy inquiries_update on public.inquiries for update using (public.has_vendor_role(vendor_id, 'editor'))
  with check (public.has_vendor_role(vendor_id, 'editor'));

create policy messages_read on public.messages for select using (exists (
  select 1 from public.inquiries i where i.id = inquiry_id
   and (public.has_vendor_role(i.vendor_id) or i.couple_user_id = auth.uid())));
create policy messages_vendor_insert on public.messages for insert to authenticated with check (
  sender = 'vendor' and sender_id = auth.uid() and exists (
    select 1 from public.inquiries i where i.id = inquiry_id and public.has_vendor_role(i.vendor_id, 'editor')));
create policy messages_couple_insert on public.messages for insert to authenticated with check (
  sender = 'couple' and sender_id = auth.uid() and exists (
    select 1 from public.inquiries i where i.id = inquiry_id and i.couple_user_id = auth.uid()));
create policy messages_mark_read on public.messages for update using (exists (
  select 1 from public.inquiries i where i.id = inquiry_id and public.has_vendor_role(i.vendor_id)));

create policy qr_all     on public.quick_replies for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy quotes_read  on public.quotes for select using (public.has_vendor_role(vendor_id) or exists (
  select 1 from public.inquiries i where i.id = inquiry_id and i.couple_user_id = auth.uid() and quotes.status <> 'draft'));
create policy quotes_write on public.quotes for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));

-- Disponibilités : le public passe par la vue `public_availability` (sans note ni demande liée)
create policy avail_team on public.availability for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy avail_read on public.availability for select using (public.has_vendor_role(vendor_id));

create policy reviews_read  on public.reviews for select using ((status = 'published' and public.vendor_is_public(vendor_id)) or public.has_vendor_role(vendor_id));
-- le prestataire ne peut que répondre (pas modifier la note ni le texte) : contrôlé côté serveur
create policy reviews_reply on public.reviews for update using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));
create policy rr_team       on public.review_requests for all using (public.has_vendor_role(vendor_id, 'editor')) with check (public.has_vendor_role(vendor_id, 'editor'));

create policy followers_self on public.followers for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy followers_team on public.followers for select using (public.has_vendor_role(vendor_id));

-- Statistiques : lecture équipe ; écriture réservée au serveur (aucune politique d'insertion)
create policy events_team on public.analytics_events   for select using (public.has_vendor_role(vendor_id, 'manager'));
create policy stats_team  on public.vendor_stats_daily for select using (public.has_vendor_role(vendor_id));

-- Facturation : lecture owner/manager ; écriture uniquement via webhooks (service role)
create policy subs_read     on public.subscriptions for select using (public.has_vendor_role(vendor_id));
create policy invoices_read on public.invoices      for select using (public.has_vendor_role(vendor_id, 'manager'));

create policy notif_self       on public.notifications      for select using (user_id = auth.uid());
create policy notif_mark_read  on public.notifications      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_prefs_self on public.notification_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vue publique des disponibilités (n'expose ni la note ni la demande)
create view public.public_availability with (security_invoker = false) as
  select a.vendor_id, a.day, a.status
    from public.availability a
    join public.vendors v on v.id = a.vendor_id and v.status = 'published'
   where a.day >= current_date;
grant select on public.public_availability to anon, authenticated;

-- Les réponses aux avis ne peuvent pas réécrire l'avis lui-même
create or replace function public.guard_review_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' and (new.rating <> old.rating or new.body <> old.body or new.author_names <> old.author_names) then
    raise exception 'REVIEW_READ_ONLY' using errcode = '42501';
  end if;
  if new.reply is distinct from old.reply then new.replied_at := now(); end if;
  return new;
end $$;
create trigger reviews_guard before update on public.reviews
  for each row execute function public.guard_review_update();

-- =====================================================================
-- 16. STOCKAGE (Supabase Storage)
-- =====================================================================
-- vendor-media   : public en lecture (chemins non devinables), écriture équipe
-- vendor-private : devis PDF, pièces jointes, factures — lecture équipe uniquement
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('vendor-media', 'vendor-media', true, 524288000,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']),
  ('vendor-private', 'vendor-private', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Convention de chemin : {vendor_id}/... — le premier dossier sert au contrôle d'accès
create or replace function public.storage_vendor_id(object_name text) returns uuid
language plpgsql immutable as $$
begin
  return ((storage.foldername(object_name))[1])::uuid;
exception when others then
  return null;
end $$;

create policy media_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-media' and public.has_vendor_role(public.storage_vendor_id(name), 'editor'));
create policy media_modify on storage.objects for update to authenticated
  using (bucket_id = 'vendor-media' and public.has_vendor_role(public.storage_vendor_id(name), 'editor'));
create policy media_remove on storage.objects for delete to authenticated
  using (bucket_id = 'vendor-media' and public.has_vendor_role(public.storage_vendor_id(name), 'editor'));

create policy private_read on storage.objects for select to authenticated
  using (bucket_id = 'vendor-private' and public.has_vendor_role(public.storage_vendor_id(name)));
create policy private_write on storage.objects for insert to authenticated
  with check (bucket_id = 'vendor-private' and public.has_vendor_role(public.storage_vendor_id(name), 'editor'));

-- =====================================================================
-- 17. TEMPS RÉEL
-- =====================================================================
-- Le client s'abonne aux nouvelles lignes ; la RLS filtre ce que chacun reçoit.
alter publication supabase_realtime add table public.notifications, public.messages, public.inquiries;
