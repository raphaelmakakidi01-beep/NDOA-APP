// Lance l'espace pro en MODE DÉMO (données fictives) même si .env.local contient des clés Supabase.
// Usage : node scripts/dev-demo.mjs [port]   — développement uniquement.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] ?? "3000";
const child = spawn("npx", ["next", "dev", "-p", port], {
  cwd: web, stdio: "inherit", shell: true, env: { ...process.env, NEXT_PUBLIC_FORCE_DEMO: "1" },
});
child.on("exit", (code) => process.exit(code ?? 0));
