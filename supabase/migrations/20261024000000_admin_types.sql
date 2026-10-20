-- =====================================================================
-- Espace admin (1/2) : types
-- Fichier séparé : une valeur ajoutée à un enum doit être validée (commit)
-- avant d'être utilisée par la migration suivante.
-- =====================================================================

-- Rôle sur la plateforme (distinct du rôle dans l'équipe d'un prestataire)
create type public.platform_role as enum ('user', 'prestataire', 'moderateur', 'admin');

-- Validation des vitrines avant publication
alter type public.vendor_status add value if not exists 'pending_review';
alter type public.vendor_status add value if not exists 'rejected';

-- Signalements
create type public.report_target as enum ('media', 'review', 'vendor', 'story');
create type public.report_status as enum ('open', 'resolved', 'dismissed');
