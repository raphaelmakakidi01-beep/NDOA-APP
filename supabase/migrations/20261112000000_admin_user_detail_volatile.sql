-- La fiche utilisateur (admin) note chaque consultation dans le journal d'audit (write_audit).
-- Déclarée STABLE, PostgREST l'exécutait en transaction lecture seule :
-- « cannot execute INSERT in a read-only transaction ». Elle doit être VOLATILE.
alter function public.admin_user_detail(uuid) volatile;
