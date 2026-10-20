import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s — Admin NDOA" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
