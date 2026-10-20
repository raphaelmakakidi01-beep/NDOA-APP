import { Bell, Globe, Shield, Trash2, User, Users } from "lucide-react";

/** Sections des paramètres (module partagé serveur / client) */
export const SECTIONS = [
  { id: "compte", label: "Compte", icon: User },
  { id: "securite", label: "Sécurité", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "equipe", label: "Équipe", icon: Users },
  { id: "langue", label: "Langue et région", icon: Globe },
  { id: "suppression", label: "Données et suppression", icon: Trash2 },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];
