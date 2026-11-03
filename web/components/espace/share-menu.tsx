"use client";

import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { Check, Eye, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useEspaceMaybe } from "@/lib/espace/store";
import { profileUrl } from "@/lib/config";

const itemCls = "flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-surface-2";
const Brand = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" className="size-4 text-muted" fill="currentColor" aria-hidden><path d={d} /></svg>;
const WA = "M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1c-.2.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.4-.3Z";
const FB = "M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3a21 21 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1Z";
const X = "M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z";
const TG = "M21.5 3.5 2.9 10.7c-1.3.5-1.2 1.2-.2 1.5l4.8 1.5 1.8 5.6c.2.6.4.8.8.8.4 0 .6-.2.9-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8L22.9 4.8c.3-1.3-.5-1.8-1.4-1.3ZM9.7 14.2l-.4 4.1-1.5-4.9L18.6 7l-8.9 7.2Z";

/** Bouton d'en-tête : partager le lien public de la vitrine (copie, WhatsApp, Facebook…) */
export function ShareMenu() {
  const ctx = useEspaceMaybe();
  const v = ctx?.vendor;
  if (!v?.slug) return null;
  const published = v.review?.status === "published";
  const url = profileUrl(v.slug);
  const text = `Découvrez ${v.name} sur NDOA Wedding`;
  const enc = encodeURIComponent;
  const targets = [
    { label: "WhatsApp", icon: WA, href: `https://wa.me/?text=${enc(`${text} : ${url}`)}` },
    { label: "Facebook", icon: FB, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X (Twitter)", icon: X, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "Telegram", icon: TG, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
  ];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié", { description: url });
    } catch {
      toast.error("Copie impossible : sélectionnez le lien dans la barre d’adresse de votre vitrine.");
    }
  };
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-3 text-sm font-semibold text-muted outline-none hover:border-gold hover:text-text focus-visible:border-gold sm:px-4" aria-label="Partager mon profil">
        <Share2 className="size-4" aria-hidden /><span className="hidden sm:inline">Partager mon profil</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-72 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
          {published ? (
            <>
              <DropdownMenu.Label className="truncate px-3 py-2 text-xs text-muted">{url.replace(/^https?:\/\//, "")}</DropdownMenu.Label>
              <DropdownMenu.Item onSelect={copy} className={itemCls}><Link2 className="size-4 text-muted" aria-hidden />Copier le lien</DropdownMenu.Item>
              {canNativeShare && (
                <DropdownMenu.Item className={itemCls} onSelect={() => { navigator.share({ title: v.name, text, url }).catch(() => {}); }}>
                  <Share2 className="size-4 text-muted" aria-hidden />Autres applications…
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              {targets.map((t) => (
                <DropdownMenu.Item key={t.label} asChild>
                  <a href={t.href} target="_blank" rel="noopener noreferrer" className={itemCls}><Brand d={t.icon} />{t.label}</a>
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" className={itemCls}><Eye className="size-4 text-muted" aria-hidden />Voir ma page</a>
              </DropdownMenu.Item>
            </>
          ) : (
            <>
              <p className="flex gap-2 px-3 py-2.5 text-[13px] leading-snug text-muted"><Check className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />Votre lien sera partageable dès que votre vitrine sera publiée par l’équipe NDOA.</p>
              <DropdownMenu.Item asChild>
                <Link href="/espace/vitrine?apercu=1" className={itemCls}><Eye className="size-4 text-muted" aria-hidden />Voir l’aperçu de ma page</Link>
              </DropdownMenu.Item>
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
