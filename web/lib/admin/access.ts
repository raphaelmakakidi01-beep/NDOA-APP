/* Règles d'accès de l'espace admin — sans dépendance, partagées par le proxy (serveur) et l'interface.
   Le rôle est de toute façon revérifié en base à chaque lecture et action (RLS + fonctions admin_*). */

export type StaffRole = "admin" | "moderateur";
export const STAFF_ROLES: readonly string[] = ["admin", "moderateur"];

/** Sections du back-office. `ready` : section disponible. */
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Tableau de bord", roles: ["admin", "moderateur"], ready: true, group: "Pilotage" },
  { href: "/admin/validation", label: "File de validation", roles: ["admin", "moderateur"], ready: true, group: "Pilotage", badge: "queue" },
  { href: "/admin/prestataires", label: "Prestataires", roles: ["admin", "moderateur"], ready: true, group: "Pilotage" },
  { href: "/admin/moderation", label: "Modération", roles: ["admin", "moderateur"], ready: true, group: "Pilotage" },
  { href: "/admin/mise-en-avant", label: "Mise en avant", roles: ["admin"], ready: true, group: "Contenu" },
  { href: "/admin/categories", label: "Catégories et villes", roles: ["admin"], ready: true, group: "Contenu" },
  { href: "/admin/pages", label: "Pages et contenus", roles: ["admin"], ready: true, group: "Contenu" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", roles: ["admin"], ready: true, group: "Gestion" },
  { href: "/admin/demandes", label: "Demandes de devis", roles: ["admin"], ready: true, group: "Gestion" },
  { href: "/admin/abonnements", label: "Abonnements", roles: ["admin"], ready: true, group: "Gestion" },
  { href: "/admin/communication", label: "Communication", roles: ["admin"], ready: true, group: "Gestion" },
  { href: "/admin/parametres", label: "Paramètres", roles: ["admin"], ready: true, group: "Gestion" },
] as const satisfies readonly { href: string; label: string; roles: readonly StaffRole[]; ready: boolean; group: string; badge?: string }[];

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** Section correspondant à un chemin (la plus spécifique) */
export function sectionFor(path: string): AdminSection | undefined {
  return [...ADMIN_SECTIONS].sort((a, b) => b.href.length - a.href.length)
    .find((n) => (n.href === "/admin" ? path === "/admin" : path === n.href || path.startsWith(`${n.href}/`)));
}

/** Le rôle peut-il ouvrir ce chemin ? */
export function canAccess(role: string | null | undefined, path: string) {
  if (!role || !STAFF_ROLES.includes(role)) return false;
  const s = sectionFor(path);
  // chemin inconnu sous /admin : réservé aux admins
  return s ? (s.roles as readonly string[]).includes(role) : role === "admin";
}
