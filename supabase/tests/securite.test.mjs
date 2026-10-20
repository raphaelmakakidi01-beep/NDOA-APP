// Tests de sécurité : exécute les migrations sur PGlite (auth/storage simulés) puis vérifie RLS et garde-fous.
// Lancement : cd supabase/tests && npm install && npm test
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite({ extensions: { citext } });

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create extension if not exists citext;
create schema if not exists extensions;
create or replace function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$
  select decode(string_agg(md5(random()::text), ''), 'hex') from generate_series(1, (n / 16) + 1) $$;
create schema auth;
create table auth.users (id uuid primary key, email text, phone text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create publication supabase_realtime;
`;

const results = [];
const ok = (name, cond, extra = "") => { results.push([cond ? "OK " : "ÉCHEC", name, extra]); };

async function as(user, role, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ""}', false), set_config('request.jwt.claim.role', '${role}', false); set role ${role === "service_role" ? "postgres" : role};`);
  try { return await fn(); } finally { await db.exec("reset role;"); }
}
async function expectError(name, sql, code) {
  try { await db.exec(sql); ok(name, false, "aucune erreur"); }
  catch (e) { ok(name, !code || String(e.message).includes(code), e.message.slice(0, 80)); }
}

await db.exec(STUBS);
const migs = fs.readdirSync(path.join(ROOT, "migrations")).sort();
for (const f of migs) {
  let sql = fs.readFileSync(path.join(ROOT, "migrations", f), "utf8").replace(/create extension if not exists pgcrypto[^;]*;/g, "").replace(/create extension if not exists citext with schema public;/g, "");
  try { await db.exec(sql); console.log("migration OK :", f); }
  catch (e) { console.log("migration ÉCHEC :", f, "\n ", e.message); process.exit(1); }
}
await db.exec(fs.readFileSync(path.join(ROOT, "seed.sql"), "utf8"));
console.log("seed OK");
await db.exec(`grant usage on schema public, storage, auth to anon, authenticated;
  grant all on all tables in schema public to anon, authenticated; grant all on storage.objects to anon, authenticated;
  grant execute on all functions in schema public, auth, storage to anon, authenticated;`);

// --- Données : propriétaire O, éditeur E, intrus X
const O = "00000000-0000-0000-0000-00000000000a", E = "00000000-0000-0000-0000-00000000000b", X = "00000000-0000-0000-0000-00000000000c";
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${O}', 'o@x.cd', '{"full_name":"Owner"}'), ('${E}', 'e@x.cd', '{}'), ('${X}', 'x@x.cd', '{}');`);
let vid;
await as(O, "authenticated", async () => {
  const r = await db.query(`insert into vendors (owner_id, slug, name, city, phone) values ('${O}', 'studio-test', 'Studio Test', 'Kinshasa', '+243810000000') returning id`);
  vid = r.rows[0].id;
});
ok("le propriétaire crée sa vitrine (membre « owner » ajouté)", !!vid);
await db.exec(`insert into vendor_members (vendor_id, user_id, role, status) values ('${vid}', '${E}', 'editor', 'active');`);
await as(O, "authenticated", () => expectError("Garde-fou : publication impossible sans 6 photos", `update vendors set status = 'published' where id = '${vid}'`, "PUBLISH_NEEDS_6_PHOTOS"));
// publication directe (les garde-fous de publication sont testés à part) : on force le statut en tant que service
await db.exec(`alter table vendors disable trigger user; update vendors set status = 'published' where id = '${vid}'; alter table vendors enable trigger user;`);

// S1 — vendeurs
await as(E, "authenticated", () => expectError("S1 : un éditeur ne peut pas changer le propriétaire", `update vendors set owner_id = '${E}' where id = '${vid}'`, "OWNER_CHANGE_FORBIDDEN"));
await as(E, "authenticated", async () => {
  await db.exec(`update vendors set rating_avg = 5, followers_count = 99999, tagline = 'ok' where id = '${vid}'`);
  const r = await db.query(`select rating_avg, followers_count, tagline from vendors where id = '${vid}'`);
  ok("S1 : note et abonnés non modifiables, champs normaux oui", Number(r.rows[0].rating_avg) === 0 && r.rows[0].followers_count === 0 && r.rows[0].tagline === "ok");
});
await as(E, "authenticated", () => expectError("S1 : un éditeur ne peut pas dépublier", `update vendors set status = 'draft' where id = '${vid}'`, "PUBLISH_MANAGER_ONLY"));
await as(X, "authenticated", async () => {
  await db.exec(`update vendors set tagline = 'piraté' where id = '${vid}'`);
  const r = await db.query(`select tagline from vendors where id = '${vid}'`);
  ok("RLS : un autre compte ne modifie pas la vitrine", r.rows[0].tagline === "ok");
});
await as(X, "authenticated", async () => {
  const r = await db.query(`select count(*)::int n from inquiries where vendor_id = '${vid}'`);
  ok("RLS : un autre compte ne voit pas les demandes", r.rows[0].n === 0);
});

// S7 — demande publique
let inq;
await as(null, "anon", async () => {
  const r = await db.query(`select submit_inquiry('studio-test', 'Grâce & Patrick', 'g@p.cd', null, 'email', current_date + 60, 'Kinshasa', 200, null, null, 'Bonjour', 'profil') as id`);
  inq = r.rows[0].id;
});
ok("S7 : un visiteur anonyme envoie une demande", !!inq);
await as(null, "anon", () => expectError("S7 : date passée refusée", `select submit_inquiry('studio-test', 'A B', 'a@b.cd', null, null, current_date - 1, null, null, null, null, null)`, "DATE_INVALID"));
await as(null, "anon", () => expectError("S7 : contact obligatoire", `select submit_inquiry('studio-test', 'A B', '', '', null, null, null, null, null, null, null)`, "CONTACT_REQUIRED"));
await as(null, "anon", async () => {
  for (let i = 0; i < 2; i++) await db.query(`select submit_inquiry('studio-test', 'Grâce & Patrick', 'g@p.cd', null, null, null, null, null, null, null, 'relance')`);
});
await as(null, "anon", () => expectError("S7 : limite de 3 demandes / 24 h par contact", `select submit_inquiry('studio-test', 'Grâce & Patrick', 'g@p.cd', null, null, null, null, null, null, null, 'spam')`, "RATE_LIMITED"));
await as(null, "anon", () => expectError("RLS : un anonyme ne peut pas insérer directement une demande", `insert into inquiries (vendor_id, couple_names, email) values ('${vid}', 'X', 'x@x.cd')`));
await as(E, "authenticated", async () => {
  const r = await db.query(`select count(*)::int n from inquiries where vendor_id = '${vid}'`);
  ok("S7 : l'équipe voit les demandes reçues", r.rows[0].n === 3, `${r.rows[0].n}`);
});

// S3 — messages
await as(null, "service_role", () => db.exec(`insert into messages (inquiry_id, sender, body) values ('${inq}', 'couple', 'Message du couple')`));
await as(E, "authenticated", () => expectError("S3 : l'équipe ne peut pas réécrire un message", `update messages set body = 'faux' where inquiry_id = '${inq}'`, "MESSAGE_READ_ONLY"));
await as(E, "authenticated", async () => {
  await db.exec(`update messages set read_at = now() where inquiry_id = '${inq}'`);
  const r = await db.query(`select read_at from messages where inquiry_id = '${inq}'`);
  ok("S3 : l'équipe peut marquer un message comme lu", !!r.rows[0].read_at);
});

// S2 — avis
let rev;
await as(null, "service_role", async () => {
  const r = await db.query(`insert into reviews (vendor_id, author_names, rating, body, status) values ('${vid}', 'Couple', 2, 'Un avis critique mais honnête sur la prestation.', 'published') returning id`);
  rev = r.rows[0].id;
});
await as(E, "authenticated", () => expectError("S2 : l'équipe ne peut pas masquer un avis", `update reviews set status = 'hidden' where id = '${rev}'`, "REVIEW_READ_ONLY"));
await as(E, "authenticated", () => expectError("S2 : l'équipe ne peut pas changer la note", `update reviews set rating = 5 where id = '${rev}'`, "REVIEW_READ_ONLY"));
await as(E, "authenticated", async () => {
  await db.exec(`update reviews set reply = 'Merci pour votre retour.' where id = '${rev}'`);
  const r = await db.query(`select reply, replied_at from reviews where id = '${rev}'`);
  ok("S2 : l'équipe peut répondre", r.rows[0].reply && r.rows[0].replied_at);
});

// S4 — médias
await as(E, "authenticated", () => expectError("S4 : fichier absent du stockage refusé", `insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'photo', '${vid}/photos/x.webp', 10, 'image/webp')`, "MEDIA_FILE_MISSING"));
await as(null, "service_role", () => db.exec(`insert into storage.objects (bucket_id, name, metadata) values ('vendor-media', '${vid}/photos/a.webp', '{"mimetype":"image/webp","size":900000}'), ('vendor-media', '${vid}/photos/b.mp4', '{"mimetype":"video/mp4","size":5000}')`));
await as(E, "authenticated", async () => {
  await db.exec(`insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'photo', '${vid}/photos/a.webp', 10, 'image/webp')`);
  const r = await db.query(`select size_bytes from media where storage_path = '${vid}/photos/a.webp'`);
  ok("S4 : la taille réelle du fichier remplace la taille déclarée", Number(r.rows[0].size_bytes) === 900000, r.rows[0].size_bytes);
});
await as(E, "authenticated", async () => {
  await db.exec(`update media set size_bytes = 1 where storage_path = '${vid}/photos/a.webp'`);
  const r = await db.query(`select size_bytes from media where storage_path = '${vid}/photos/a.webp'`);
  ok("S4 : la taille ne peut pas être réduite après coup", Number(r.rows[0].size_bytes) === 900000);
});
await as(E, "authenticated", () => expectError("S4 : une vidéo déclarée comme photo est refusée", `insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'photo', '${vid}/photos/b.mp4', 10, 'image/webp')`, "MEDIA_TYPE_MISMATCH"));
await as(E, "authenticated", () => expectError("S4 : chemin hors du dossier du prestataire refusé", `insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'photo', '00000000-0000-0000-0000-000000000999/photos/a.webp', 10, 'image/webp')`, "MEDIA_PATH_FORBIDDEN"));

// S5 — équipe
await as(E, "authenticated", () => expectError("S5 : un éditeur ne peut pas ajouter de membre", `insert into vendor_members (vendor_id, invited_email, role, status) values ('${vid}', 'z@z.cd', 'manager', 'invited')`));
await as(O, "authenticated", () => expectError("S5 : un membre actif ne s'ajoute pas sans invitation", `insert into vendor_members (vendor_id, user_id, role, status) values ('${vid}', '${X}', 'editor', 'active')`));
await as(O, "authenticated", async () => {
  await db.exec(`insert into vendor_members (vendor_id, invited_email, role, status) values ('${vid}', 'z@z.cd', 'editor', 'invited')`);
  ok("S5 : le propriétaire invite un membre", true);
});
await as(E, "authenticated", () => expectError("S5 : un éditeur ne s'auto-promeut pas", `update vendor_members set role = 'manager' where user_id = '${E}' returning 1`).then(async () => {
  const r = await db.query(`select role from vendor_members where user_id = '${E}'`);
  if (results.at(-1)[0] !== "OK ") results[results.length - 1] = [r.rows[0].role === "editor" ? "OK " : "ÉCHEC", "S5 : un éditeur ne s'auto-promeut pas", "rôle inchangé (0 ligne)"];
}));

// S8 — statistiques
await as(null, "anon", async () => {
  await db.query(`select track_event('studio-test', 'profile_view', 'recherche', null, 'v1')`);
  await db.query(`select track_event('studio-test', 'profile_view', 'recherche', null, 'v1')`);
  await db.query(`select track_event('studio-test', 'quote_request', null, null, 'v1')`);
});
await as(O, "authenticated", async () => {
  const r = await db.query(`select event, count(*)::int n from analytics_events where vendor_id = '${vid}' group by event order by event`);
  const m = Object.fromEntries(r.rows.map((x) => [x.event, x.n]));
  ok("S8 : vue de profil enregistrée et dédoublonnée", m.profile_view === 1, JSON.stringify(m));
  ok("S8 : un visiteur ne peut pas forger « quote_request »", m.quote_request === 3, "3 = les 3 vraies demandes");
});
await as(null, "anon", () => expectError("RLS : un anonyme ne lit pas les statistiques brutes", `select 1/(count(*)::int) from analytics_events`));

// Disponibilités publiques
await as(O, "authenticated", () => db.exec(`insert into availability (vendor_id, day, status, note) values ('${vid}', current_date + 10, 'booked', 'Mariage privé')`));
await as(null, "anon", async () => {
  const r = await db.query(`select * from get_public_availability('studio-test')`);
  ok("Calendrier public : statut visible, note privée masquée", r.rows.length === 1 && !("note" in r.rows[0]));
});

// Balayage de toutes les tables liées à une vitrine : lecture et écriture par un autre compte
const tables = (await db.query(`select table_name t from information_schema.columns
  where table_schema = 'public' and column_name = 'vendor_id'
    and table_name in (select tablename from pg_tables where schemaname = 'public') order by 1`)).rows.map((r) => r.t);
// Données publiques d'une vitrine publiée (affichées sur le profil)
const PUBLIC_OK = new Set(["albums", "media", "packages", "package_options", "reviews", "stories", "vendor_categories", "vendor_languages", "vendor_zones", "faqs", "vendor_socials"]);
const leaks = [], writes = [];
await as(X, "authenticated", async () => {
  for (const t of tables) {
    const n = (await db.query(`select count(*)::int n from ${t} where vendor_id = '${vid}'`)).rows[0].n;
    if (n && !PUBLIC_OK.has(t)) leaks.push(`${t}:${n}`);
    try { const u = await db.query(`update ${t} set vendor_id = vendor_id where vendor_id = '${vid}'`); if (u.affectedRows) writes.push(t); }
    catch { /* refus = attendu */ }
    try { const d = await db.query(`delete from ${t} where vendor_id = '${vid}'`); if (d.affectedRows) writes.push(`${t} (suppression)`); }
    catch { /* refus = attendu */ }
  }
});
ok(`RLS : un autre prestataire ne lit aucune donnée privée (${tables.length} tables)`, !leaks.length, leaks.join(" "));
ok(`RLS : un autre prestataire ne modifie ni ne supprime rien (${tables.length} tables)`, !writes.length, writes.join(" "));
let draft;
await as(X, "authenticated", async () => {
  draft = (await db.query(`insert into vendors (owner_id, slug, name, city) values ('${X}', 'brouillon-x', 'Brouillon X', 'Kinshasa') returning id`)).rows[0].id;
});
await as(null, "anon", async () => {
  const r = await db.query(`select slug from vendors where id in ('${vid}', '${draft}')`);
  ok("RLS : profil publié lisible par tous, brouillon invisible", r.rows.length === 1 && r.rows[0].slug === "studio-test", JSON.stringify(r.rows));
});
await as(O, "authenticated", async () => {
  const r = await db.query(`select count(*)::int n from vendors where id = '${draft}'`);
  ok("RLS : le brouillon d'un autre prestataire est invisible", r.rows[0].n === 0);
});

// Uploads : formats et taille contrôlés côté serveur
await as(null, "service_role", () => db.exec(`insert into storage.objects (bucket_id, name, metadata) values
  ('vendor-media', '${vid}/videos/c.mov', '{"mimetype":"video/quicktime","size":5000}'),
  ('vendor-media', '${vid}/photos/d.avif', '{"mimetype":"image/avif","size":5000}'),
  ('vendor-media', '${vid}/photos/e.webp', '{"mimetype":"image/webp","size":9000000}')`));
await as(E, "authenticated", () => expectError("Uploads : vidéo MOV refusée (MP4 uniquement)", `insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'video', '${vid}/videos/c.mov', 10, 'video/mp4')`, "MEDIA_TYPE_MISMATCH"));
await as(E, "authenticated", () => expectError("Uploads : photo AVIF refusée", `insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'photo', '${vid}/photos/d.avif', 10, 'image/webp')`, "MEDIA_TYPE_MISMATCH"));
await as(E, "authenticated", () => expectError("Uploads : photo non compressée (> 5 Mo) refusée", `insert into media (vendor_id, kind, storage_path, size_bytes, mime_type) values ('${vid}', 'photo', '${vid}/photos/e.webp', 10, 'image/webp')`, "FILE_TOO_LARGE"));
const bucket = (await db.query(`select allowed_mime_types a from storage.buckets where id = 'vendor-media'`)).rows[0].a;
ok("Uploads : le bucket n'accepte que JPEG, PNG, WebP et MP4", JSON.stringify([...bucket].sort()) === JSON.stringify(["image/jpeg", "image/png", "image/webp", "video/mp4"]), bucket.join(","));

// =====================================================================
// ESPACE ADMIN : rôles, validation, modération, audit
// =====================================================================
const A = "00000000-0000-0000-0000-0000000000ad", M = "00000000-0000-0000-0000-0000000000a0";
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'admin@ndoa.cd', '{"full_name":"Admin"}'), ('${M}', 'modo@ndoa.cd', '{"full_name":"Modo"}');`);
await as(null, "service_role", () => db.exec(`update profiles set role = 'admin' where id = '${A}'`));
const roleOf = async (id) => (await db.query(`select role from profiles where id = '${id}'`)).rows[0].role;

// Rôles
await as(X, "authenticated", () => expectError("Admin : un utilisateur ne peut pas se promouvoir admin", `update profiles set role = 'admin' where id = '${X}'`, "ROLE_ADMIN_ONLY"));
ok("Admin : le propriétaire d'une vitrine devient « prestataire »", (await roleOf(O)) === "prestataire" && (await roleOf(X)) === "prestataire", `${await roleOf(O)} / ${await roleOf(X)}`);
await as(M, "authenticated", () => expectError("Admin : un non-admin ne peut pas attribuer de rôle", `select admin_set_role('${M}', 'moderateur')`, "ADMIN_ONLY"));
await as(A, "authenticated", () => db.query(`select admin_set_role('${M}', 'moderateur')`));
ok("Admin : l'admin nomme un modérateur", (await roleOf(M)) === "moderateur");
await as(A, "authenticated", () => expectError("Admin : un admin ne change pas son propre rôle", `select admin_set_role('${A}', 'user')`, "ROLE_SELF_CHANGE"));

// Préparation d'une vitrine publiable (6 photos, forfait, contact, catégorie) : le brouillon de X
await as(null, "service_role", () => db.exec(`
  alter table media disable trigger user;
  insert into media (vendor_id, kind, storage_path, mime_type, size_bytes, status)
    select '${draft}', 'photo', '${draft}/p' || g || '.webp', 'image/webp', 1000, 'ready' from generate_series(1, 6) g;
  alter table media enable trigger user;
  insert into packages (vendor_id, name, price_amount) values ('${draft}', 'Formule', 50000);
  insert into vendor_categories (vendor_id, category_id, is_primary) values ('${draft}', 1, true);
  update vendors set phone = '+243810000001' where id = '${draft}';`));
const statusOf = async (id) => (await db.query(`select status from vendors where id = '${id}'`)).rows[0].status;

// Circuit de validation
await as(X, "authenticated", () => db.exec(`update vendors set approved_at = now() where id = '${draft}'`));
await as(X, "authenticated", () => db.exec(`update vendors set status = 'published' where id = '${draft}'`));
ok("Validation : la 1re publication part en file d'attente (approved_at non falsifiable)", (await statusOf(draft)) === "pending_review", await statusOf(draft));
await as(X, "authenticated", () => expectError("Validation : un prestataire ne s'auto-valide pas", `update vendors set status = 'rejected' where id = '${draft}'`, "STATUS_ADMIN_ONLY"));
await as(null, "anon", async () => {
  const r = await db.query(`select count(*)::int n from vendors where id = '${draft}'`);
  ok("Validation : une vitrine en attente est invisible du public", r.rows[0].n === 0);
});
await as(M, "authenticated", async () => {
  const r = await db.query(`select count(*)::int n from vendors where status = 'pending_review'`);
  const p = await db.query(`select count(*)::int n from media where vendor_id = '${draft}'`);
  ok("Validation : le modérateur voit la file et l'aperçu (médias)", r.rows[0].n === 1 && p.rows[0].n === 6, `${r.rows[0].n} / ${p.rows[0].n}`);
});
await as(M, "authenticated", () => expectError("Validation : refus sans motif impossible", `select admin_review_vendor('${draft}', 'reject', '  ')`, "REASON_REQUIRED"));
await as(M, "authenticated", () => db.query(`select admin_review_vendor('${draft}', 'reject', 'Photos floues : remplacez la couverture')`));
const outbox = (await db.query(`select template, to_email from email_outbox where template = 'vendor_rejected'`)).rows;
ok("Validation : refus → statut « rejected » + e-mail avec motif en file d'envoi", (await statusOf(draft)) === "rejected" && outbox.length === 1 && outbox[0].to_email === "x@x.cd", JSON.stringify(outbox));
await as(X, "authenticated", () => db.exec(`update vendors set status = 'published' where id = '${draft}'`));
ok("Validation : après correction, le prestataire renvoie en validation", (await statusOf(draft)) === "pending_review");
await as(M, "authenticated", async () => {
  const r = await db.query(`select admin_review_vendors(array['${draft}'::uuid, '00000000-0000-0000-0000-000000000999'::uuid], 'approve') as r`);
  ok("Validation groupée : 1 validée, 1 erreur signalée sans tout annuler", r.rows[0].r.ok === 1 && r.rows[0].r.errors.length === 1, JSON.stringify(r.rows[0].r));
});
ok("Validation : vitrine publiée après approbation", (await statusOf(draft)) === "published");

// Badge, suspension, suppression : admin uniquement
await as(M, "authenticated", () => expectError("Admin : le modérateur ne peut pas attribuer le badge Vérifié", `select admin_set_verified('${draft}', true)`, "ADMIN_ONLY"));
await as(A, "authenticated", () => db.query(`select admin_set_verified('${draft}', true)`));
await as(A, "authenticated", () => db.query(`select admin_suspend_vendor('${draft}', true, 'Fraude signalée')`));
await as(X, "authenticated", () => expectError("Suspension : le prestataire ne peut pas se republier", `update vendors set status = 'published' where id = '${draft}'`, "VENDOR_SUSPENDED"));
await as(A, "authenticated", () => db.query(`select admin_suspend_vendor('${draft}', false, 'Vérifié')`));
ok("Suspension : la levée remet la vitrine validée en ligne", (await statusOf(draft)) === "published");
await as(A, "authenticated", () => expectError("Suppression : confirmation par le slug obligatoire", `select admin_delete_vendor('${draft}', 'mauvais-slug', 'Doublon')`, "CONFIRMATION_MISMATCH"));

// Modération
let rep;
await as(null, "anon", async () => {
  rep = (await db.query(`select report_content('media', (select id from media where vendor_id = '${draft}' limit 1), 'inapproprie', 'Photo choquante', null, 'visiteur-1') as id`)).rows[0].id;
  const again = (await db.query(`select report_content('media', (select id from media where vendor_id = '${draft}' limit 1), 'inapproprie', null, null, 'visiteur-1') as id`)).rows[0].id;
  ok("Signalement : un visiteur signale une photo (dédoublonné)", !!rep && again === rep);
});
await as(null, "anon", () => expectError("Signalement : motif hors liste refusé", `select report_content('media', (select id from media limit 1), 'nimporte', null, null, 'v2')`, "REASON_INVALID"));
await as(null, "anon", () => expectError("RLS : un anonyme ne lit pas les signalements", `select 1/(count(*)::int) from reports`));
const mid = (await db.query(`select target_id from reports where id = '${rep}'`)).rows[0].target_id;
await as(M, "authenticated", () => expectError("Modération : masquer sans motif impossible", `select admin_moderate('media', '${mid}', 'hide')`, "REASON_REQUIRED"));
await as(M, "authenticated", async () => {
  const n = (await db.query(`select admin_moderate('media', '${mid}', 'hide', 'inapproprie', 'contenu choquant') as n`)).rows[0].n;
  ok("Modération : le modérateur masque la photo et clôt le signalement", n === 1);
});
await as(null, "anon", async () => {
  const r = await db.query(`select count(*)::int n from media where id = '${mid}'`);
  ok("Modération : la photo masquée n'est plus publique", r.rows[0].n === 0);
});
await as(X, "authenticated", () => expectError("Modération : le prestataire ne peut pas démasquer", `update media set is_hidden = false where id = '${mid}'`, "MODERATION_STAFF_ONLY"));

// Mise en avant de l'accueil
await as(M, "authenticated", () => expectError("Mise en avant : réservée aux admins", `insert into featured_slides (vendor_id, media_id) values ('${draft}', '${mid}')`));
await as(A, "authenticated", () => db.exec(`
  insert into featured_slides (vendor_id, image_path, title) values ('${draft}', 'hero/1.webp', 'Slide');
  insert into featured_slides (vendor_id, image_path, title, starts_at) values ('${draft}', 'hero/2.webp', 'Futur', now() + interval '3 days');
  insert into home_picks (section, vendor_id) values ('recommandations', '${draft}');`));
await as(null, "anon", async () => {
  const r = await db.query(`select title from featured_slides`);
  ok("Mise en avant : le public ne voit que les slides actifs et en cours", r.rows.length === 1 && r.rows[0].title === "Slide", JSON.stringify(r.rows));
});
ok("Mise en avant : « Nos recommandations » pose le badge Recommandé", (await db.query(`select is_recommended from vendors where id = '${draft}'`)).rows[0].is_recommended === true);
await as(A, "authenticated", () => expectError("Mise en avant : un seul prestataire « à la une »", `insert into home_picks (section, vendor_id) values ('a_la_une', '${draft}'), ('a_la_une', '${vid}')`));

// Journal d'audit
await as(A, "authenticated", () => db.exec(`update vendors set tagline = 'Modifié par l''admin' where id = '${vid}'`));
await as(A, "authenticated", async () => {
  const r = await db.query(`select action, actor_role, reason from audit_logs order by id`);
  const acts = r.rows.map((x) => x.action);
  const need = ["user.role", "vendor.reject", "vendor.approve", "vendor.verify", "vendor.suspend", "vendor.unsuspend", "media.hide", "featured_slides.insert", "vendors.update"];
  const missing = need.filter((a) => !acts.includes(a));
  ok("Audit : chaque action du staff est journalisée (auteur, rôle, motif)", !missing.length && r.rows.find((x) => x.action === "vendor.reject")?.reason?.includes("Photos floues"), missing.join(","));
  const del = await db.query(`delete from audit_logs`);
  ok("Audit : le journal est inaltérable (suppression refusée)", !del.affectedRows);
});
await as(M, "authenticated", async () => {
  const r = await db.query(`select count(*)::int n from audit_logs`);
  ok("Audit : le modérateur ne lit pas le journal", r.rows[0].n === 0);
});
await as(X, "authenticated", () => expectError("Audit : un prestataire ne peut pas écrire dans le journal", `insert into audit_logs (action, target_type) values ('faux', 'x')`));

// Tableau de bord
await as(M, "authenticated", async () => {
  const d = (await db.query(`select admin_dashboard(7) as d`)).rows[0].d;
  ok("Tableau de bord : KPI pour le modérateur, sans les revenus", d.prestataires_actifs >= 2 && d.revenus_mois === null && d.series.length === 7, `actifs=${d.prestataires_actifs} séries=${d.series.length}`);
});
await as(X, "authenticated", () => expectError("Tableau de bord : refusé aux non-staff", `select admin_dashboard(30)`, "ADMIN_ONLY"));
await as(null, "anon", () => expectError("Admin : les fonctions admin sont interdites aux anonymes", `select admin_review_vendor('${draft}', 'approve')`));

// Étape 3 : ordre par glisser-déposer et contenu public de l'accueil
await as(A, "authenticated", () => db.exec(`insert into home_picks (section, vendor_id) values ('recommandations', '${vid}')`));
const picks = (await db.query(`select id from home_picks where section = 'recommandations' order by created_at`)).rows.map((r) => r.id);
await as(M, "authenticated", () => expectError("Ordre : réservé aux admins", `select admin_reorder('home_picks', array['${picks[1]}', '${picks[0]}'])`, "ADMIN_ONLY"));
await as(A, "authenticated", () => db.query(`select admin_reorder('home_picks', array['${picks[1]}', '${picks[0]}'])`));
await as(null, "anon", async () => {
  const h = (await db.query(`select get_home_content() as h`)).rows[0].h;
  ok("Accueil public : recommandations dans l'ordre choisi, slide actif uniquement",
    h.recommandations.map((v) => v.slug).join(",") === "studio-test,brouillon-x" && h.slides.length === 1 && h.categories.length === 11 && h.cities.length === 10,
    `${h.recommandations.map((v) => v.slug)} / slides=${h.slides.length}`);
});
await as(A, "authenticated", async () => {
  const n = (await db.query(`select count(*)::int n from audit_logs where action = 'home_picks.reorder'`)).rows[0].n;
  ok("Ordre : le réordonnancement est journalisé", n === 2, String(n));
});
await as(null, "service_role", () => db.exec(`alter table vendors disable trigger user; update vendors set status = 'suspended' where id = '${vid}'; alter table vendors enable trigger user;`));
await as(null, "anon", async () => {
  const h = (await db.query(`select get_home_content() as h`)).rows[0].h;
  ok("Accueil public : une vitrine suspendue disparaît des recommandations", h.recommandations.length === 1);
});
await as(null, "service_role", () => db.exec(`alter table vendors disable trigger user; update vendors set status = 'published' where id = '${vid}'; alter table vendors enable trigger user;`));

// Toutes les tables ont la RLS active
const noRls = (await db.query(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows.map((r) => r.relname);
ok("RLS active sur toutes les tables (y compris admin)", !noRls.length, noRls.join(","));

console.log("\n" + results.map((r) => r.join("  ")).join("\n"));
console.log(`\n${results.filter((r) => r[0] === "OK ").length}/${results.length} contrôles réussis`);
