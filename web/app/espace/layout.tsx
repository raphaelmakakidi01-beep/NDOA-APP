import type { Metadata } from "next";
import { EspaceShell } from "@/components/espace/shell";

export const metadata: Metadata = { title: { default: "Espace prestataire", template: "%s — NDOA Pro" }, robots: { index: false, follow: false } };

export default function Layout({ children }: LayoutProps<"/espace">) {
  return <EspaceShell>{children}</EspaceShell>;
}
