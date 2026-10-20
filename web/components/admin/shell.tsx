"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import {
  BarChart3, ChevronsLeft, ChevronsRight, ClipboardCheck, CreditCard, ExternalLink, FileText, Flag, LayoutDashboard,
  LogOut, Megaphone, Menu, Settings, ShieldAlert, Sparkles, Store, Tags, Users,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark, Logo, ThemeToggle } from "@/components/brand";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin/access";
import { signOut } from "@/lib/auth";
import { DEMO, PUBLIC_SITE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";
import { AdminProvider, useAdmin } from "./context";

const ICONS: Record<AdminSection["href"], React.ComponentType<{ className?: string }>> = {
  "/admin": LayoutDashboard, "/admin/validation": ClipboardCheck, "/admin/prestataires": Store, "/admin/moderation": Flag,
  "/admin/mise-en-avant": Sparkles, "/admin/categories": Tags, "/admin/pages": FileText, "/admin/utilisateurs": Users,
  "/admin/demandes": BarChart3, "/admin/abonnements": CreditCard, "/admin/communication": Megaphone, "/admin/parametres": Settings,
};
const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

/* Préférence « sidebar repliée », sans écart d’hydratation */
const listeners = new Set<() => void>();
function useCollapsed(): [boolean, (v: boolean) => void] {
  const value = React.useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => { try { return localStorage.getItem("ndoa.admin.sidebar") === "1"; } catch { return false; } },
    () => false,
  );
  return [value, (v) => { try { localStorage.setItem("ndoa.admin.sidebar", v ? "1" : "0"); } catch { /* stockage indisponible */ } listeners.forEach((l) => l()); }];
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <div className="admin-ui min-h-dvh lg:flex">
        <React.Suspense fallback={<div className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line bg-surface/40 lg:block" aria-hidden />}>
          <Sidebar />
        </React.Suspense>
        <div className="min-w-0 flex-1">
          <React.Suspense fallback={<div className="h-14 border-b border-line" />}>
            <Topbar />
          </React.Suspense>
          <main id="contenu" className="mx-auto w-full max-w-[1400px] px-3 pb-24 pt-4 sm:px-5 lg:px-8 lg:pb-12 lg:pt-6">
            <Gate>{children}</Gate>
          </main>
        </div>
      </div>
    </AdminProvider>
  );
}

/**
 * Garde côté interface. Le contrôle qui fait foi est côté serveur (proxy) et en base (RLS, admin_*) :
 * pendant le chargement, la page s'affiche avec ses propres squelettes (rendu instantané).
 */
function Gate({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAdmin();
  if (!loading && !me) {
    return (
      <EmptyState className="mx-auto mt-16 max-w-lg" icon={<ShieldAlert />} title="Accès réservé à l’équipe NDOA"
        action={<Button asChild variant="outline" size="sm"><Link href="/connexion?suite=/admin">Se connecter avec un compte admin</Link></Button>}>
        Votre compte n’a pas le rôle administrateur ou modérateur.
      </EmptyState>
    );
  }
  return <>{children}</>;
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const path = usePathname();
  const { me, pending } = useAdmin();
  const sections = ADMIN_SECTIONS.filter((s) => !me || (s.roles as readonly string[]).includes(me.role));
  const groups = [...new Set(sections.map((s) => s.group))];
  return (
    <nav aria-label="Sections de l’administration" className="grid gap-4">
      {groups.map((g) => (
        <div key={g}>
          {!collapsed && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[.14em] text-muted/80">{g}</p>}
          <ul className="grid gap-0.5">
            {sections.filter((s) => s.group === g).map((s) => {
              const Icon = ICONS[s.href];
              const on = isActive(path, s.href);
              const count = "badge" in s && s.badge === "queue" ? pending : 0;
              const inner = (
                <>
                  {on && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" aria-hidden />}
                  <Icon className={cn("size-[17px] shrink-0", on && "text-gold-ink")} aria-hidden />
                  {collapsed ? <span className="sr-only">{s.label}</span> : <span className="flex-1 truncate">{s.label}</span>}
                  {count > 0 && (
                    <span className={cn("grid min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-on-gold tabular", collapsed && "absolute right-1.5 top-1")}>
                      {count}<span className="sr-only"> en attente</span>
                    </span>
                  )}
                  {!collapsed && !s.ready && <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">bientôt</span>}
                </>
              );
              const cls = cn("group relative flex h-10 items-center gap-3 rounded-lg text-[13.5px] font-semibold transition-colors",
                collapsed ? "justify-center" : "px-3",
                on ? "bg-gold/12 text-text" : "text-muted hover:bg-surface-2 hover:text-text");
              return (
                <li key={s.href}>
                  {s.ready ? (
                    <Link href={s.href} onClick={onNavigate} aria-current={on ? "page" : undefined} title={collapsed ? s.label : undefined} className={cls}>{inner}</Link>
                  ) : (
                    <span aria-disabled="true" title={`${s.label} — disponible prochainement`} className={cn(cls, "cursor-not-allowed opacity-55 hover:bg-transparent hover:text-muted")}>{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Sidebar() {
  const [collapsed, setCollapsed] = useCollapsed();
  return (
    <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/40 py-4 transition-[width] duration-300 lg:flex", collapsed ? "w-[72px] px-2.5" : "w-[248px] px-3")}
      aria-label="Navigation de l’administration">
      <Link href="/admin" className={cn("mb-5 flex items-center gap-2 rounded-lg", collapsed ? "justify-center" : "px-2")} aria-label="Administration NDOA — tableau de bord">
        <BrandMark variant={collapsed ? "mark" : "wordmark"} size="sm" />
        {!collapsed && <span className="rounded-md border border-gold/40 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[.16em] text-gold-ink">Admin</span>}
      </Link>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"><NavList collapsed={collapsed} /></div>
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Déplier le menu" : "Replier le menu"} aria-expanded={!collapsed}
        className={cn("mt-3 flex h-9 items-center gap-3 rounded-lg text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-text", collapsed ? "justify-center" : "px-3")}>
        {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <><ChevronsLeft className="size-4" aria-hidden />Replier</>}
      </button>
    </aside>
  );
}

function Topbar() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useAdmin();
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => {
    if (params.get("refuse") === "1") toast.error("Cette section est réservée aux administrateurs.");
  }, [params]);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/88 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-3 sm:px-5 lg:px-8">
        <button type="button" onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-lg border border-line text-muted hover:text-text lg:hidden" aria-label="Ouvrir le menu" aria-haspopup="dialog">
          <Menu className="size-4" aria-hidden />
        </button>
        <Logo href="/admin" size="sm" className="lg:hidden" />
        {DEMO && <span className="hidden rounded-md bg-gold/15 px-2 py-1 text-xs font-semibold text-gold-ink sm:inline">Mode démo · données fictives</span>}
        <div className="ml-auto flex items-center gap-2">
          <a href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-2 rounded-full border border-line px-3.5 text-[13px] font-semibold text-muted hover:border-gold hover:text-text sm:inline-flex">
            <ExternalLink className="size-3.5" aria-hidden />Site public
          </a>
          <ThemeToggle className="size-9" />
          {me && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="flex h-9 items-center gap-2 rounded-full border border-line pl-1 pr-3 text-[13px] font-semibold hover:border-gold" aria-label="Menu du compte">
                <span className="grid size-7 place-items-center rounded-full bg-gold/20 text-xs font-bold text-gold-ink">{me.name.slice(0, 1).toUpperCase()}</span>
                <span className="hidden sm:inline">{me.role === "admin" ? "Admin" : "Modérateur"}</span>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="admin-ui z-50 min-w-56 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
                  <DropdownMenu.Label className="px-3 py-2">
                    <span className="block text-sm font-semibold">{me.name}</span>
                    <span className="block text-xs text-muted">{me.email} · {me.role === "admin" ? "Administrateur" : "Modérateur"}</span>
                  </DropdownMenu.Label>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item onSelect={async () => { await signOut(); router.replace("/connexion"); }}
                    className="flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-danger outline-none data-[highlighted]:bg-danger/10">
                    <LogOut className="size-4" aria-hidden />Se déconnecter
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>
      <Dialog open={menu} onOpenChange={setMenu} title="Administration" className="admin-ui">
        <NavList onNavigate={() => setMenu(false)} />
      </Dialog>
    </header>
  );
}
