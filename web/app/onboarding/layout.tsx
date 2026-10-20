import type { Metadata } from "next";
import { OnboardingShell } from "@/components/onboarding/shell";

export const metadata: Metadata = { title: "Création de votre vitrine", robots: { index: false, follow: false } };

export default function Layout({ children }: LayoutProps<"/onboarding">) {
  return <OnboardingShell>{children}</OnboardingShell>;
}
