import { Camera, Clapperboard, Megaphone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Services que l'équipe NDOA propose aux prestataires (sur devis, contact WhatsApp) */
export const VENDOR_SERVICES: { id: string; icon: LucideIcon; title: string; text: string; items: string[] }[] = [
  {
    id: "contenu",
    icon: Camera,
    title: "Création de contenu",
    text: "Des photos et des visuels qui donnent envie de vous réserver, prêts pour votre vitrine NDOA et vos réseaux.",
    items: ["Séance photo de vos réalisations", "Visuels pour vos publications et vos stories", "Textes et légendes qui vendent", "Mise en valeur de votre vitrine NDOA"],
  },
  {
    id: "reseaux",
    icon: Megaphone,
    title: "Gestion de vos réseaux sociaux",
    text: "Nous publions pour vous, régulièrement, pendant que vous vous consacrez aux mariés.",
    items: ["Calendrier de publications", "Facebook, Instagram et TikTok", "Réponses aux messages et commentaires", "Bilan des résultats chaque mois"],
  },
  {
    id: "video",
    icon: Clapperboard,
    title: "Vidéos de présentation",
    text: "Une vidéo courte et soignée qui présente votre savoir-faire en quelques secondes.",
    items: ["Vidéo de 30 secondes pour la couverture de votre vitrine", "Formats verticaux pour reels et stories", "Tournage et montage", "Musique et titres inclus"],
  },
];

export const vendorServicesWaUrl = (digits: string, service?: string) =>
  `https://wa.me/${digits}?text=${encodeURIComponent(
    service
      ? `Bonjour NDOA, je suis prestataire et je suis intéressé(e) par le service « ${service} ». Pouvez-vous m’en dire plus ?`
      : "Bonjour NDOA, je suis prestataire et j’aimerais en savoir plus sur vos services (contenu, réseaux sociaux, vidéos).",
  )}`;

const WaIcon = ({ className }: { className?: string }) => (
  <svg className={cn("size-[18px] shrink-0", className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z" /></svg>
);

const btn = "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";
const btnGold = cn(btn, "bg-gold text-on-gold shadow-[inset_0_0_0_1px_rgba(255,255,255,.25)] hover:brightness-105");
const btnOutline = cn(btn, "border border-line-strong text-text hover:border-gold hover:text-gold-ink");

/** Bouton WhatsApp vers l'équipe NDOA (caché si aucun numéro n'est configuré) */
export function ServicesWaButton({ whatsapp, service, label, variant = "gold", className }: { whatsapp: string; service?: string; label: string; variant?: "gold" | "outline"; className?: string }) {
  if (!whatsapp) return null;
  return (
    <a className={cn(variant === "gold" ? btnGold : btnOutline, className)} href={vendorServicesWaUrl(whatsapp, service)} target="_blank" rel="noopener noreferrer">
      <WaIcon />{label}
    </a>
  );
}

const STEPS = [
  { title: "Écrivez-nous sur WhatsApp", text: "Dites-nous votre métier, votre ville et ce dont vous avez besoin." },
  { title: "Recevez une proposition", text: "Nous définissons ensemble le contenu, le calendrier et le devis." },
  { title: "Nous produisons, vous validez", text: "Rien n’est publié sans votre accord." },
];

/** Les trois services, avec un contact WhatsApp par service */
export function VendorServicesGrid({ whatsapp, compact }: { whatsapp: string; compact?: boolean }) {
  return (
    <div className={cn("grid gap-5", compact ? "md:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-3")}>
      {VENDOR_SERVICES.map((s) => (
        <article key={s.id} id={s.id} className={cn("grid min-w-0 scroll-mt-24 content-start gap-5 rounded-3xl border border-line bg-surface", compact ? "p-6" : "p-7")}>
          <span className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold-ink"><s.icon className="size-5" aria-hidden /></span>
          <div>
            <h3 className={cn("font-display leading-tight", compact ? "text-2xl" : "text-3xl")}>{s.title}</h3>
            <p className="mt-2 text-muted">{s.text}</p>
          </div>
          <ul className="grid gap-2 text-[15px]">
            {s.items.map((i) => <li key={i} className="flex gap-2.5"><span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />{i}</li>)}
          </ul>
          <ServicesWaButton whatsapp={whatsapp} service={s.title} label="Demander sur WhatsApp" variant="outline" className="mt-auto w-full px-3 text-sm" />
        </article>
      ))}
    </div>
  );
}

/** Déroulé en trois étapes */
export function VendorServicesSteps() {
  return (
    <ol className="grid gap-8 md:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="grid content-start gap-2 border-t border-line-strong pt-5">
          <span className="font-display text-4xl leading-none text-gold-ink" aria-hidden>{i + 1}</span>
          <h3 className="font-bold">{s.title}</h3>
          <p className="text-muted">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
