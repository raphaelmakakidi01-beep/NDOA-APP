import { BarChart3, Calendar, CreditCard, Home, Images, Inbox, MessageSquareQuote, Settings, Store, Tags } from "lucide-react";

/** Navigation de l’espace. `ready` = section disponible (toutes depuis l’étape 5). */
export const NAV = [
  { href: "/espace", label: "Accueil", icon: Home, ready: true },
  { href: "/espace/demandes", label: "Demandes", icon: Inbox, ready: true, badge: "inquiries" as const },
  { href: "/espace/vitrine", label: "Ma vitrine", icon: Store, ready: true },
  { href: "/espace/galerie", label: "Galerie", icon: Images, ready: true },
  { href: "/espace/tarifs", label: "Tarifs", icon: Tags, ready: true },
  { href: "/espace/calendrier", label: "Calendrier", icon: Calendar, ready: true },
  { href: "/espace/avis", label: "Avis", icon: MessageSquareQuote, ready: true },
  { href: "/espace/statistiques", label: "Statistiques", icon: BarChart3, ready: true },
  { href: "/espace/abonnement", label: "Abonnement", icon: CreditCard, ready: true },
  { href: "/espace/parametres", label: "Paramètres", icon: Settings, ready: true },
];

/** Barre d’onglets mobile : 4 raccourcis + « Plus » */
export const MOBILE_TABS = ["/espace", "/espace/demandes", "/espace/galerie", "/espace/tarifs"];
