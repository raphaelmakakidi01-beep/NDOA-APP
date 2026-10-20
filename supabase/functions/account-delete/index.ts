// POST {} — supprime le compte de l'utilisateur connecté.
// Ses vitrines (dont il est propriétaire) sont supprimées en cascade, avec leurs fichiers.
import { admin, asUser, cors, json } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors();
  const { data: auth } = await asUser(req).auth.getUser();
  if (!auth.user) return json({ error: "UNAUTHENTICATED" }, 401);
  const db = admin();

  const { data: vendors } = await db.from("vendors").select("id").eq("owner_id", auth.user.id);
  for (const v of vendors ?? []) {
    for (const bucket of ["vendor-media", "vendor-private"]) {
      const { data: files } = await db.storage.from(bucket).list(v.id, { limit: 1000 });
      if (files?.length) await db.storage.from(bucket).remove(files.map((f) => `${v.id}/${f.name}`));
    }
    await db.from("vendors").delete().eq("id", v.id);
  }
  await db.auth.admin.deleteUser(auth.user.id);
  return json({ ok: true });
});
