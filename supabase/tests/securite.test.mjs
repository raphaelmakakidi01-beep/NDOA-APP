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

console.log("\n" + results.map((r) => r.join("  ")).join("\n"));
console.log(`\n${results.filter((r) => r[0] === "OK ").length}/${results.length} contrôles réussis`);
