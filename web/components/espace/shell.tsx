"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { DropdownMenu, Popover } from "radix-ui";
import { Bell, ChevronsLeft, ChevronsRight, ExternalLink, LogOut, MoreHorizontal, Settings, Sparkles } from "lucide-react";
import { Logo, ThemeToggle } from "@/components/brand";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, timeAgo } from "@/components/ui/bits";
import { signOut } from "@/lib/auth";
import { EspaceProvider, useEspaceMaybe } from "@/lib/espace/store";
import { PLANS } from "@/lib/espace/types";
import { cn } from "@/lib/utils";
import { MOBILE_TABS, NAV } from "./nav";

/* Préférence « sidebar repliée » partagée entre onglets, sans écart d’hydratation */
const listeners = new Set<() => void>();
function useCollapsed(): [boolean, (v: boolean) => void] {
  const value = React.useSyncExternalStore(
    (cb) => { listeners.add(cb); window.addEventListener("storage", cb); return () => { listeners.delete(cb); window.removeEventListener("storage", cb); }; },
    () => localStorage.getItem("eclat.sidebar") === "1",
    () => false,
  );
  return [value, (v) => { localStorage.setItem("eclat.sidebar", v ? "1" : "0"); listeners.forEach((l) => l()); }];
}

const isActive = (path: string, href: string) => (href === "/espace" ? path === "/espace" : path.startsWith(href));

function useNewInquiries() {
  const ctx = useEspaceMaybe();
  return ctx?.data.inquiries.filter((i) => i.status === "new").length ?? 0;
}

export function EspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <EspaceProvider>
      <div className="min-h-dvh lg:flex">
        {/* Le chemin courant n’est connu qu’à l’exécution sur les routes dynamiques */}
        <React.Suspense fallback={<div className="sticky top-0 hidden h-dvh w-[264px] shrink-0 border-r border-line bg-surface/40 lg:block" aria-hidden />}>
          <Sidebar />
        </React.Suspense>
        <div className="min-w-0 flex-1">
          <Topbar />
          <main id="contenu" className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">{children}</main>
        </div>
      </div>
      <React.Suspense fallback={null}>
        <MobileTabBar />
      </React.Suspense>
    </EspaceProvider>
  );
}

function VendorBadge({ compact }: { compact?: boolean }) {
  const ctx = useEspaceMaybe();
  if (!ctx) return <div className="flex items-center gap-3 px-2"><span className="skeleton size-10 shrink-0 rounded-full" />{!compact && <span className="skeleton h-4 w-32 rounded" />}</div>;
  const { vendor, data } = ctx;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl px-2 py-2", !compact && "border border-line bg-surface-2/50 px-3")}>
      {vendor.avatar?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vendor.avatar.url} alt="" className="size-10 shrink-0 rounded-full object-cover ring-2 ring-gold/70" />
      ) : <span className="size-10 shrink-0 rounded-full bg-surface-2" />}
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{vendor.name}</p>
          <p className="text-xs text-gold-ink">Offre {PLANS[data.plan].name}</p>
        </div>
      )}
    </div>
  );
}

function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useCollapsed();
  const newCount = useNewInquiries();
  return (
    <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface/40 py-5 transition-[width] duration-300 lg:flex", collapsed ? "w-[84px] px-3" : "w-[264px] px-4")}
      aria-label="Navigation de l’espace prestataire">
      <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between px-2")}>
        {collapsed ? <Logo href="/espace" variant="mark" size="md" /> : <Logo href="/espace" />}
      </div>
      <VendorBadge compact={collapsed} />
      <nav className="mt-6 flex-1 overflow-y-auto" aria-label="Sections">
        <ul className="grid gap-1">
          {NAV.map((n) => {
            const on = isActive(path, n.href);
            const badge = n.badge === "inquiries" ? newCount : 0;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} title={collapsed ? n.label : undefined}
                  className={cn("group relative flex h-11 items-center gap-3 rounded-xl text-sm font-semibold transition-colors",
                    collapsed ? "justify-center" : "px-3",
                    on ? "bg-gold/15 text-text" : "text-muted hover:bg-surface-2 hover:text-text")}>
                  {on && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gold" aria-hidden />}
                  <n.icon className={cn("size-[18px] shrink-0", on && "text-gold-ink")} aria-hidden />
                  {!collapsed && <span className="flex-1">{n.label}</span>}
                  {collapsed && <span className="sr-only">{n.label}</span>}
                  {badge > 0 && (
                    <span className={cn("grid min-w-5 place-items-center rounded-full bg-rose px-1.5 text-[11px] font-bold text-[#0A0A0B]", collapsed && "absolute right-2 top-1.5")}>
                      {badge}<span className="sr-only"> nouvelles</span>
                    </span>
                  )}
                  {!collapsed && !n.ready && <span className="text-[11px] font-medium text-muted/80">bientôt</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Déplier le menu" : "Replier le menu"} aria-expanded={!collapsed}
        className={cn("mt-4 flex h-10 items-center gap-3 rounded-xl text-sm font-semibold text-muted hover:bg-surface-2 hover:text-text", collapsed ? "justify-center" : "px-3")}>
        {collapsed ? <ChevronsRight className="size-4" aria-hidden /> : <><ChevronsLeft className="size-4" aria-hidden />Replier</>}
      </button>
    </aside>
  );
}

function Notifications() {
  const ctx = useEspaceMaybe();
  const unread = ctx?.data.notifications.filter((n) => !n.read).length ?? 0;
  return (
    <Popover.Root>
      <Popover.Trigger className="relative grid size-10 place-items-center rounded-full border border-line text-muted hover:border-gold hover:text-text" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
        <Bell className="size-4" aria-hidden />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-rose px-1 text-[11px] font-bold text-[#0A0A0B]">{unread}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="z-50 w-[min(92vw,380px)] rounded-2xl border border-line bg-surface p-2 shadow-2xl outline-none data-[state=open]:animate-[fadeIn_.15s_ease-out]">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-display text-lg">Notifications</p>
            {unread > 0 && <button onClick={() => ctx?.markAllRead()} className="text-xs font-semibold text-gold-ink hover:underline">Tout marquer comme lu</button>}
          </div>
          {!ctx || ctx.data.notifications.length === 0 ? (
            <EmptyState className="m-2 py-8" icon={<Bell />} title="Rien de neuf">Vous serez prévenu ici de chaque demande, message et avis.</EmptyState>
          ) : (
            <ul className="max-h-[60dvh] overflow-y-auto">
              {ctx.data.notifications.map((n) => (
                <li key={n.id}>
                  <Popover.Close asChild>
                    <Link href={n.link} className="flex gap-3 rounded-xl px-3 py-3 hover:bg-surface-2">
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-rose")} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{n.title}{!n.read && <span className="sr-only"> (non lue)</span>}</span>
                        {n.body && <span className="block truncate text-[13px] text-muted">{n.body}</span>}
                        <span className="text-xs text-muted">{timeAgo(n.createdAt)}</span>
                      </span>
                    </Link>
                  </Popover.Close>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function UserMenu() {
  const router = useRouter();
  const ctx = useEspaceMaybe();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="rounded-full" aria-label="Menu du compte">
        <VendorBadge compact />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
          <DropdownMenu.Label className="px-3 py-2 text-xs text-muted">{ctx?.user.email ?? ctx?.user.phone ?? "Mon compte"}</DropdownMenu.Label>
          {[{ href: "/espace/parametres", label: "Paramètres", icon: Settings }, { href: "/espace/abonnement", label: "Mon offre", icon: Sparkles }].map((i) => (
            <DropdownMenu.Item key={i.href} asChild>
              <Link href={i.href} className="flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-surface-2"><i.icon className="size-4 text-muted" aria-hidden />{i.label}</Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item onSelect={async () => { await signOut(); router.replace("/connexion"); }}
            className="flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-danger outline-none data-[highlighted]:bg-danger/10">
            <LogOut className="size-4" aria-hidden />Se déconnecter
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Logo href="/espace" className="lg:hidden" />
        <div className="ml-auto flex items-center gap-2">
          <Link href="/espace/vitrine?apercu=1" className="hidden h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-muted hover:border-gold hover:text-text sm:inline-flex">
            <ExternalLink className="size-4" aria-hidden />Voir ma page
          </Link>
          <ThemeToggle />
          <Notifications />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function MobileTabBar() {
  const path = usePathname();
  const [more, setMore] = React.useState(false);
  const newCount = useNewInquiries();
  const tabs = NAV.filter((n) => MOBILE_TABS.includes(n.href));
  const moreOn = !tabs.some((t) => isActive(path, t.href));
  return (
    <>
      <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/92 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {tabs.map((t) => {
            const on = isActive(path, t.href);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? "page" : undefined} className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold", on ? "text-gold-ink" : "text-muted")}>
                  <t.icon className="size-5" aria-hidden />{t.label}
                  {t.badge && newCount > 0 && <span className="absolute left-1/2 top-2 ml-2 grid min-w-4.5 place-items-center rounded-full bg-rose px-1 text-[10px] font-bold text-[#0A0A0B]">{newCount}<span className="sr-only"> nouvelles</span></span>}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-semibold", moreOn ? "text-gold-ink" : "text-muted")}>
              <MoreHorizontal className="size-5" aria-hidden />Plus
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={more} onOpenChange={setMore} title="Plus">
        <ul className="grid grid-cols-2 gap-2">
          {NAV.filter((n) => !MOBILE_TABS.includes(n.href)).map((n) => (
            <li key={n.href}>
              <Link href={n.href} onClick={() => setMore(false)} aria-current={isActive(path, n.href) ? "page" : undefined}
                className={cn("flex h-14 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold", isActive(path, n.href) ? "border-gold bg-gold/10" : "border-line")}>
                <n.icon className="size-5 text-gold-ink" aria-hidden />{n.label}
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
