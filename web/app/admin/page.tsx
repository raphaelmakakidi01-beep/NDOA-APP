import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/dashboard";

// le modèle de titre du layout ne s’applique pas à la page de son propre segment
export const metadata: Metadata = { title: { absolute: "Tableau de bord — Admin NDOA" } };

export default function Page() {
  return <AdminDashboard />;
}
