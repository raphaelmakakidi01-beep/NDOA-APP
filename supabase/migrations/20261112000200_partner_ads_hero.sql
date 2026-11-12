-- Publicités partenaires : option pour les afficher aussi en fond du bandeau d'accueil (diaporama du hero)
alter table public.partner_ads add column if not exists show_in_hero boolean not null default true;
