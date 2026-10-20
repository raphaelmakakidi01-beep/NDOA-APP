-- =========================================================
-- Étape 5 : avis, statistiques, abonnement, paramètres
-- =========================================================

-- ---------- Colonnes complémentaires ----------
alter table public.review_requests add column if not exists channel text not null default 'lien'
  check (channel in ('whatsapp', 'email', 'lien'));
alter table public.invoices        add column if not exists months smallint not null default 1 check (months in (1, 12));
alter table public.subscriptions   add column if not exists provider_method public.payment_method;
alter table public.subscriptions   add column if not exists provider_account text;   -- numéro masqué « •••• 45 67 »

-- Délai de première réponse (comparaison avec la catégorie)
alter table public.inquiries add column if not exists first_response_at timestamptz;
create or replace function public.set_first_response() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender = 'vendor' then
    update inquiries set first_response_at = new.created_at where id = new.inquiry_id and first_response_at is null;
  end if;
  return new;
end $$;
drop trigger if exists messages_first_response on public.messages;
create trigger messages_first_response after insert on public.messages for each row execute function public.set_first_response();

-- Transactions en cours chez l'agrégateur (écrites uniquement par les Edge Functions)
create table if not exists public.payment_intents (
  ref           text primary key,
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  plan_id       text not null references public.plans (id),
  months        smallint not null default 1,
  amount        bigint not null,
  currency      public.currency_code not null,
  method        public.payment_method not null,
  status        text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  provider_payload jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.payment_intents enable row level security;
create policy intents_read on public.payment_intents for select using (public.has_vendor_role(vendor_id, 'owner'));

-- ---------- Dépôt d'un avis via un lien unique (formulaire public) ----------
create or replace function public.review_request_info(p_token text)
returns table (vendor_name text, couple text, wedding_date date, expired boolean, used boolean)
language sql security definer set search_path = public stable as $$
  select v.name, coalesce(i.couple_names, r.sent_to), i.wedding_date, r.expires_at < now(), r.used_at is not null
  from review_requests r
  join vendors v on v.id = r.vendor_id
  left join inquiries i on i.id = r.inquiry_id
  where r.token = p_token;
$$;

create or replace function public.submit_review(p_token text, p_names text, p_rating smallint, p_body text, p_city text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r review_requests%rowtype;
  new_id uuid;
begin
  select * into r from review_requests where token = p_token for update;
  if not found then raise exception 'REVIEW_TOKEN_UNKNOWN'; end if;
  if r.used_at is not null then raise exception 'REVIEW_TOKEN_USED'; end if;
  if r.expires_at < now() then raise exception 'REVIEW_TOKEN_EXPIRED'; end if;

  insert into reviews (vendor_id, inquiry_id, author_names, wedding_date, city, rating, body, status, is_verified)
  select r.vendor_id, r.inquiry_id, left(trim(p_names), 80),
         (select wedding_date from inquiries where id = r.inquiry_id), left(p_city, 60),
         p_rating, trim(p_body),
         'published',                                    -- l'admin peut masquer a posteriori
         exists (select 1 from inquiries where id = r.inquiry_id and status = 'confirmed')
  returning id into new_id;

  update review_requests set used_at = now() where token = p_token;
  return new_id;
end $$;

grant execute on function public.review_request_info(text) to anon, authenticated;
grant execute on function public.submit_review(text, text, smallint, text, text) to anon, authenticated;

-- ---------- Statistiques ----------
-- Photos les plus vues sur la période, avec les contacts déclenchés juste après
create or replace function public.top_photos(p_vendor uuid, p_since timestamptz)
returns table (media_id uuid, views bigint, contacts bigint)
language sql security definer set search_path = public stable as $$
  select e.media_id,
         count(*) filter (where e.event = 'photo_view'),
         count(*) filter (where e.event in ('whatsapp_click', 'call_click', 'quote_request'))
  from analytics_events e
  where e.vendor_id = p_vendor and e.created_at >= p_since and e.media_id is not null
    and public.has_vendor_role(p_vendor, 'manager')
  group by e.media_id
  order by 2 desc
  limit 8;
$$;

-- Moyennes anonymisées de la catégorie principale (30 jours, minimum 5 prestataires)
create or replace function public.category_benchmark(p_vendor uuid)
returns table (views numeric, ctr numeric, conversion numeric, response_hours numeric, rating numeric, vendors bigint)
language sql security definer set search_path = public stable as $$
  with cat as (
    select category_id from vendor_categories where vendor_id = p_vendor and is_primary limit 1
  ), peers as (
    select vc.vendor_id from vendor_categories vc join vendors v on v.id = vc.vendor_id
    where vc.category_id = (select category_id from cat) and v.status = 'published'
  ), s as (
    select d.vendor_id, sum(d.views) v, sum(d.whatsapp_clicks + d.call_clicks) c
    from vendor_stats_daily d where d.vendor_id in (select vendor_id from peers) and d.day >= current_date - 30
    group by d.vendor_id
  ), q as (
    select i.vendor_id,
           count(*) filter (where i.status = 'confirmed')::numeric / nullif(count(*) filter (where i.status in ('quote_sent', 'confirmed', 'lost')), 0) conv,
           avg(extract(epoch from (i.first_response_at - i.created_at)) / 3600) resp
    from inquiries i where i.vendor_id in (select vendor_id from peers) and i.created_at >= now() - interval '90 days'
    group by i.vendor_id
  )
  select round(avg(s.v), 0), round(avg(s.c::numeric / nullif(s.v, 0)), 4), round(avg(q.conv), 4), round(avg(q.resp), 1),
         (select round(avg(rating_avg), 2) from vendors where id in (select vendor_id from peers) and rating_count > 0),
         count(distinct s.vendor_id)
  from s left join q on q.vendor_id = s.vendor_id
  where public.has_vendor_role(p_vendor, 'manager')
  having count(distinct s.vendor_id) >= 5;
$$;

grant execute on function public.top_photos(uuid, timestamptz) to authenticated;
grant execute on function public.category_benchmark(uuid) to authenticated;
