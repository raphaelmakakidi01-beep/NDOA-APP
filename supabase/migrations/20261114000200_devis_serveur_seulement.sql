-- Devis : plus d'appel direct à submit_inquiry depuis Internet.
-- Avant : un script pouvait appeler /rest/v1/rpc/submit_inquiry avec la clé publique, sans le
-- captcha Cloudflare, et remplir les 20 demandes / heure d'une vitrine avec de faux devis
-- (les vrais couples étaient alors refusés). Seul le serveur du site, après le captcha,
-- passe désormais par submit_inquiry_server (clé serveur SUPABASE_SERVICE_ROLE_KEY sur Vercel).
revoke execute on function public.submit_inquiry(text, text, text, text, text, date, text, integer, uuid, uuid[], text, text) from public, anon, authenticated;
