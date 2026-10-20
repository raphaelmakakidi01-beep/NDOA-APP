import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";
import { APP_URL } from "@/lib/config";

const bodoni = Bodoni_Moda({ variable: "--font-bodoni", subsets: ["latin"], style: ["normal", "italic"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: "Espace prestataire — NDOA Wedding", template: "%s — NDOA Pro" },
  description: "Créez votre vitrine NDOA Wedding, gérez vos photos, vos tarifs et vos demandes de devis.",
  openGraph: {
    siteName: "NDOA Wedding", locale: "fr_FR", type: "website",
    title: "NDOA Pro — l’espace des prestataires de mariage",
    description: "Une vitrine qui ressemble à un portfolio, des demandes de devis qualifiées et vos statistiques, au même endroit.",
    images: [{ url: "/brand/og-ndoa.jpg", width: 1200, height: 630, alt: "NDOA Wedding" }],
  },
  twitter: { card: "summary_large_image", images: ["/brand/og-ndoa.jpg"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0B" },
    { media: "(prefers-color-scheme: light)", color: "#F5F0E8" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${bodoni.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a href="#contenu" className="fixed left-4 top-[-60px] z-[100] rounded-full bg-gold px-4 py-2 font-bold text-on-gold transition-[top] focus:top-4">
          Aller au contenu
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
