"use client";

import * as React from "react";
import { getMe, pendingCount, type StaffMe } from "@/lib/admin/api";

type Ctx = { me: StaffMe | null; loading: boolean; pending: number; refreshPending: () => void; isAdmin: boolean };
const AdminCtx = React.createContext<Ctx | null>(null);

/** Session staff (rôle lu en base) + compteur de la file de validation */
export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = React.useState<StaffMe | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(0);

  // mises à jour en transition : React finit d'hydrater la navigation (frontières Suspense) avant de les appliquer
  const refreshPending = React.useCallback(() => {
    pendingCount().then((n) => React.startTransition(() => setPending(n))).catch(() => {});
  }, []);

  React.useEffect(() => {
    let alive = true;
    getMe()
      .then((m) => { if (alive) React.startTransition(() => { setMe(m); setLoading(false); }); if (m) refreshPending(); })
      .catch(() => alive && React.startTransition(() => setLoading(false)));
    return () => { alive = false; };
  }, [refreshPending]);

  const value = React.useMemo(() => ({ me, loading, pending, refreshPending, isAdmin: me?.role === "admin" }), [me, loading, pending, refreshPending]);
  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const c = React.useContext(AdminCtx);
  if (!c) throw new Error("useAdmin hors de AdminProvider");
  return c;
}
