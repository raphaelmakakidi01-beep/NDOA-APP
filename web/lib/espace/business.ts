"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { goldConfetti } from "@/lib/confetti";
import { uid } from "@/lib/utils";
import { useEspace } from "./store";
import { remote4 } from "./remote-step4";
import {
  INQUIRY_STATUS, PLAN_MAX_PACKAGES, quoteTotal,
  type DayEntry, type EspaceData, type Inquiry, type InquiryStatus, type Message, type Package, type PackageOption, type Promotion, type QuickReply, type Quote,
} from "./types";

/* =========================================================
   Règles métier de l’étape 4 (tarifs, demandes, devis, calendrier)
   Mode démo : tout est appliqué localement.
   Supabase : on écrit en base ; les triggers font le reste
   (calendrier, notifications), l’état local reflète le résultat.
   ========================================================= */

const DEMO_REPLIES = [
  "Merci beaucoup pour votre retour rapide ! On en parle ce soir et on vous redit très vite.",
  "Parfait, c’est exactement ce que nous cherchions. Pouvez-vous nous envoyer le devis ?",
  "Super ! Est-ce que l’acompte peut se régler par M-Pesa ?",
];

export const fillTemplate = (body: string, q: Inquiry) =>
  body.replaceAll("{prenoms}", q.couple).replaceAll("{date}", new Date(`${q.weddingDate}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }));

const now = () => new Date().toISOString();

/** Calendrier : conséquence d’un changement de statut (miroir du trigger SQL sync_availability) */
function syncDay(d: EspaceData, q: Inquiry, status: InquiryStatus): EspaceData["availability"] {
  const a = { ...d.availability };
  const cur = a[q.weddingDate];
  if (status === "confirmed") a[q.weddingDate] = { status: "booked", inquiryId: q.id };
  else if (status === "quote_sent" && !cur) a[q.weddingDate] = { status: "option", inquiryId: q.id };
  else if (status === "lost" && cur?.inquiryId === q.id) delete a[q.weddingDate];
  return a;
}

export function useBusiness() {
  const { data, vendor, user, patch, setTyping } = useEspace();
  const vid = vendor.vendorId;
  const demo = !getSupabase();

  return useMemo(() => {
    const persistPackages = (list: Package[]) => list.forEach((p, i) => void remote4.savePackage(vid, p, i));

    const setStatus = (id: string, status: InquiryStatus, lostReason?: string, silent = false) => {
      const q = data.inquiries.find((x) => x.id === id);
      if (!q || q.status === status) return;
      const other = data.availability[q.weddingDate];
      if (status === "confirmed" && other?.status === "booked" && other.inquiryId !== id)
        toast.warning("Attention : cette date était déjà réservée.", { description: "Vérifiez votre calendrier pour éviter un double engagement." });
      patch((d) => ({
        ...d,
        inquiries: d.inquiries.map((x) => (x.id === id ? { ...x, status, lostReason: status === "lost" ? lostReason : undefined } : x)),
        availability: syncDay(d, q, status),
        messages: silent ? d.messages : [...d.messages, { id: uid(), inquiryId: id, sender: "system", body: `Statut : ${INQUIRY_STATUS[status].label}${lostReason ? ` (${lostReason})` : ""}`, createdAt: now() }],
      }));
      void remote4.setStatus(id, status, lostReason);
      if (status === "confirmed" && !silent) toast.success(`${q.couple} : mariage confirmé`, { description: "La date est bloquée dans votre calendrier et sur votre page." });
    };

    return {
      /* ---------- Forfaits ---------- */
      savePackage(p: Package) {
        const isNew = !data.packages.some((x) => x.id === p.id);
        if (isNew && data.packages.length >= PLAN_MAX_PACKAGES[data.plan]) {
          toast.error(`Votre offre permet ${PLAN_MAX_PACKAGES[data.plan]} forfait${PLAN_MAX_PACKAGES[data.plan] > 1 ? "s" : ""}.`, { description: "Passez à l’offre supérieure pour en ajouter." });
          return false;
        }
        patch((d) => {
          let list = isNew ? [...d.packages, p] : d.packages.map((x) => (x.id === p.id ? p : x));
          if (p.featured) list = list.map((x) => (x.id === p.id ? x : { ...x, featured: false }));
          return { ...d, packages: list };
        });
        void remote4.savePackage(vid, p, isNew ? data.packages.length : data.packages.findIndex((x) => x.id === p.id)).then((err) => err && toast.error(err));
        if (p.featured) void remote4.setFeatured(vid, p.id);
        return true;
      },
      duplicatePackage(id: string) {
        const p = data.packages.find((x) => x.id === id);
        if (!p) return;
        if (data.packages.length >= PLAN_MAX_PACKAGES[data.plan]) { toast.error("Nombre maximal de forfaits atteint pour votre offre."); return; }
        const copy: Package = { ...p, id: uid(), name: `${p.name} (copie)`.slice(0, 40), featured: false, visible: false };
        patch((d) => ({ ...d, packages: [...d.packages, copy] }));
        void remote4.savePackage(vid, copy, data.packages.length);
        toast.success("Forfait dupliqué", { description: "La copie est masquée tant que vous ne l’affichez pas." });
      },
      deletePackage(id: string) {
        patch((d) => ({ ...d, packages: d.packages.filter((x) => x.id !== id), options: d.options.map((o) => (o.packageId === id ? { ...o, packageId: undefined } : o)), promotions: d.promotions.filter((x) => x.packageId !== id) }));
        void remote4.deletePackage(id);
      },
      toggleVisible(id: string) {
        const p = data.packages.find((x) => x.id === id);
        if (!p) return;
        if (p.visible && data.packages.filter((x) => x.visible).length === 1) { toast.error("Gardez au moins un forfait visible sur votre vitrine."); return; }
        const next = { ...p, visible: !p.visible, featured: p.visible ? false : p.featured };
        patch((d) => ({ ...d, packages: d.packages.map((x) => (x.id === id ? next : x)) }));
        void remote4.savePackage(vid, next, data.packages.indexOf(p));
      },
      setFeatured(id: string | null) {
        patch((d) => ({ ...d, packages: d.packages.map((x) => ({ ...x, featured: x.id === id })) }));
        void remote4.setFeatured(vid, id);
      },
      movePackage(id: string, dir: -1 | 1) {
        const i = data.packages.findIndex((x) => x.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= data.packages.length) return;
        const list = [...data.packages];
        [list[i], list[j]] = [list[j], list[i]];
        patch((d) => ({ ...d, packages: list }));
        persistPackages(list);
      },

      /* ---------- Options & promotions ---------- */
      saveOption(o: PackageOption) {
        patch((d) => ({ ...d, options: d.options.some((x) => x.id === o.id) ? d.options.map((x) => (x.id === o.id ? o : x)) : [...d.options, o] }));
        void remote4.saveOption(vid, o);
      },
      deleteOption(id: string) { patch((d) => ({ ...d, options: d.options.filter((x) => x.id !== id) })); void remote4.deleteOption(id); },
      savePromotion(p: Promotion) {
        patch((d) => ({ ...d, promotions: d.promotions.some((x) => x.id === p.id) ? d.promotions.map((x) => (x.id === p.id ? p : x)) : [...d.promotions, p] }));
        void remote4.savePromotion(vid, p);
      },
      deletePromotion(id: string) { patch((d) => ({ ...d, promotions: d.promotions.filter((x) => x.id !== id) })); void remote4.deletePromotion(id); },

      /* ---------- Demandes & messages ---------- */
      setStatus,
      markRead(id: string) {
        if (!data.inquiries.find((q) => q.id === id)?.unread) return;
        patch((d) => ({ ...d, inquiries: d.inquiries.map((q) => (q.id === id ? { ...q, unread: false } : q)) }));
        void remote4.markRead(id);
      },
      sendMessage(inquiryId: string, body: string, quoteId?: string) {
        const q = data.inquiries.find((x) => x.id === inquiryId);
        if (!q || !body.trim()) return;
        const m: Message = { id: uid(), inquiryId, sender: "vendor", body: body.trim(), quoteId, createdAt: now() };
        patch((d) => ({ ...d, messages: [...d.messages, m] }));
        void remote4.sendMessage(m, user.id);
        if (q.status === "new") setStatus(inquiryId, "discussing", undefined, true);
        // Démo : le couple répond une fois, avec indicateur de saisie
        if (demo && q.status !== "lost" && !sessionStorage.getItem(`eclat.reply.${inquiryId}`)) {
          sessionStorage.setItem(`eclat.reply.${inquiryId}`, "1");
          setTimeout(() => setTyping(inquiryId, true), 1200);
          setTimeout(() => {
            setTyping(inquiryId, false);
            const body2 = DEMO_REPLIES[inquiryId.charCodeAt(inquiryId.length - 1) % DEMO_REPLIES.length];
            patch((d) => ({
              ...d,
              messages: [...d.messages, { id: uid(), inquiryId, sender: "couple", body: body2, createdAt: now() }],
              inquiries: d.inquiries.map((x) => (x.id === inquiryId ? { ...x, unread: !location.pathname.endsWith(inquiryId) } : x)),
            }));
          }, 4200);
        }
      },
      saveQuickReply(r: QuickReply) {
        patch((d) => ({ ...d, quickReplies: d.quickReplies.some((x) => x.id === r.id) ? d.quickReplies.map((x) => (x.id === r.id ? r : x)) : [...d.quickReplies, r] }));
        void remote4.saveQuickReply(vid, r);
      },
      deleteQuickReply(id: string) { patch((d) => ({ ...d, quickReplies: d.quickReplies.filter((x) => x.id !== id) })); void remote4.deleteQuickReply(id); },

      /* ---------- Devis ---------- */
      nextQuoteNumber() {
        const year = new Date().getFullYear();
        const max = Math.max(40, ...data.quotes.map((q) => Number(q.number.split("-").pop()) || 0));
        return `ECL-${year}-${String(max + 1).padStart(4, "0")}`;
      },
      saveQuote(q: Quote, opts: { send: boolean; pdf?: Blob }) {
        const firstSent = opts.send && !data.quotes.some((x) => x.status !== "draft");
        const quote: Quote = opts.send ? { ...q, status: "sent", sentAt: now() } : q;
        patch((d) => ({ ...d, quotes: d.quotes.some((x) => x.id === q.id) ? d.quotes.map((x) => (x.id === q.id ? quote : x)) : [quote, ...d.quotes] }));
        void remote4.saveQuote(vid, quote, quoteTotal(quote), opts.pdf);
        if (!opts.send) { toast.success("Brouillon de devis enregistré"); return; }
        const sys: Message = { id: uid(), inquiryId: q.inquiryId, sender: "system", body: `Devis ${q.number} envoyé`, quoteId: q.id, createdAt: now() };
        patch((d) => ({ ...d, messages: [...d.messages, sys] }));
        const inq = data.inquiries.find((x) => x.id === q.inquiryId);
        if (inq && (inq.status === "new" || inq.status === "discussing")) setStatus(q.inquiryId, "quote_sent", undefined, true);
        if (firstSent) { goldConfetti(); toast.success("Premier devis envoyé !", { description: "Les prestataires qui répondent avec un devis en moins de 24 h signent 2× plus." }); }
        else toast.success(`Devis ${q.number} envoyé`, { description: "La date passe en option dans votre calendrier." });
      },

      /* ---------- Calendrier ---------- */
      setDay(day: string, entry: DayEntry | null) {
        patch((d) => { const a = { ...d.availability }; if (entry) a[day] = entry; else delete a[day]; return { ...d, availability: a }; });
        void remote4.setDay(vid, day, entry);
      },
      blockRange(from: string, to: string, note: string) {
        const days: string[] = [];
        for (let t = new Date(`${from}T12:00`); t <= new Date(`${to}T12:00`); t.setDate(t.getDate() + 1)) days.push(t.toISOString().slice(0, 10));
        const skipped = days.filter((x) => data.availability[x]?.status === "booked");
        patch((d) => { const a = { ...d.availability }; days.forEach((x) => { if (a[x]?.status !== "booked") a[x] = { status: "blocked", note }; }); return { ...d, availability: a }; });
        days.filter((x) => !skipped.includes(x)).forEach((x) => void remote4.setDay(vid, x, { status: "blocked", note }));
        toast.success(`${days.length - skipped.length} jour${days.length - skipped.length > 1 ? "s" : ""} bloqué${days.length - skipped.length > 1 ? "s" : ""}`, skipped.length ? { description: `${skipped.length} date(s) déjà réservée(s) laissée(s) telles quelles.` } : undefined);
      },
    };
  }, [data, vid, user.id, patch, setTyping, demo]);
}
