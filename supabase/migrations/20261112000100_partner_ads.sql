-- Partenaires & publicités : visuels gérés dans l'admin (Mise en avant), affichés sur l'accueil.
create table public.partner_ads (
  id          uuid primary key default gen_random_uuid(),
  partner     text not null check (char_length(btrim(partner)) between 1 and 80),
  title       text check (char_length(title) <= 120),
  image_path  text not null,                                   -- bucket site-media (dossier partenaires/)
  link_url    text check (link_url is null or (link_url ~* '^https?://' and char_length(link_url) <= 500)),
  sort        integer not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

alter table public.partner_ads enable row level security;

-- Lecture publique : uniquement ce qui est actif et dans sa période ; l'équipe voit tout
create policy partner_ads_public_read on public.partner_ads for select using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.is_staff());
create policy partner_ads_admin on public.partner_ads for all using (public.is_admin()) with check (public.is_admin());

grant select on public.partner_ads to anon, authenticated;
grant insert, update, delete on public.partner_ads to authenticated;

-- Journal d'audit, comme les autres contenus de l'accueil
drop trigger if exists zz_audit on public.partner_ads;
create trigger zz_audit after insert or update or delete on public.partner_ads
  for each row execute function public.audit_staff_change();
