import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getSiteTexts } from "@/lib/public/content";

export const metadata: Metadata = {
  title: { absolute: "NDOA Wedding — Bientôt disponible" },
  description: "La marketplace des prestataires de mariage en RDC ouvre très bientôt : photographes, salles, traiteurs, DJ, décorateurs à Kinshasa, Lubumbashi, Goma et Matadi.",
};

const FACEBOOK_URL = "https://www.facebook.com/Ndoawedding";
const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";

/** Page affichée au public tant que le site n'est pas ouvert (voir lib/coming-soon.ts) */
export default async function Bientot() {
  const texts = await getSiteTexts();
  const whatsapp = (texts.contactWhatsapp ?? ENV_WHATSAPP).replace(/\D/g, "");
  const wa = whatsapp && `https://wa.me/${whatsapp}?text=${encodeURIComponent("Bonjour NDOA, j’aimerais être prévenu(e) de l’ouverture du site.")}`;
  return (
    <main id="contenu" className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-[#0A0A0B] text-[#F5F0E8]">
      {/* halo doré et grain */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_38%,rgba(196,151,90,.22),transparent_70%),radial-gradient(40%_30%_at_80%_90%,rgba(196,151,90,.08),transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] -z-10 size-[min(92vw,620px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C4975A]/15" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] -z-10 size-[min(70vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C4975A]/10" />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
        <Image src="/brand/ndoa-monogramme-ivoire.webp" alt="" width={88} height={88} priority className="h-20 w-auto opacity-95 sm:h-[88px]" />
        <p className="mt-8 text-xs font-bold uppercase tracking-[.32em] text-[#E6C694]">NDOA Wedding</p>
        <h1 className="font-display mt-4 text-[3.4rem] leading-[.95] tracking-[-.02em] sm:text-[5.6rem]">
          Bientôt <em className="text-[#E6C694]">disponible.</em>
        </h1>
        <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-[#F5F0E8]/75">
          La marketplace des prestataires de mariage en RDC ouvre très bientôt{" "}: photographes, salles, traiteurs, DJ, décorateurs… à Kinshasa, Lubumbashi, Goma et Matadi.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[#C4975A] px-6 text-[15px] font-semibold text-[#0A0A0B] shadow-[inset_0_0_0_1px_rgba(255,255,255,.25)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6C694]/70">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M13.6 21.9v-8.1h2.7l.4-3.2h-3.1V8.6c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.5v3.2h2.7v8.1z" /></svg>
            Suivez-nous sur Facebook
          </a>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex h-12 items-center rounded-full border border-[#F5F0E8]/25 px-6 text-[15px] font-semibold transition hover:border-[#C4975A] hover:text-[#E6C694] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E6C694]/70">
              Être prévenu sur WhatsApp
            </a>
          )}
        </div>

        <div className="mt-14 w-full max-w-md border-t border-[#F5F0E8]/12 pt-8">
          <p className="text-[15px] text-[#F5F0E8]/70">
            Vous êtes prestataire de mariage ? Créez votre vitrine dès maintenant : elle sera en ligne le jour de l’ouverture.
          </p>
          <Link href="/pro" className="mt-3 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#E6C694] underline-offset-4 hover:underline">
            Créer ma vitrine gratuitement <span aria-hidden>→</span>
          </Link>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-5 pb-8 text-xs text-[#F5F0E8]/45">
        <span>© NDOA Wedding</span>
        <Link href="/mentions-legales" className="hover:text-[#F5F0E8]/80">Mentions légales</Link>
        <Link href="/confidentialite" className="hover:text-[#F5F0E8]/80">Confidentialité</Link>
        <Link href="/connexion" className="hover:text-[#F5F0E8]/80">Connexion</Link>
      </footer>
    </main>
  );
}
