"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import type { DayEntry, EspaceData, Inquiry, InquiryStatus, Message, Package, PackageOption, Promotion, QuickReply, Quote } from "./types";

/* =========================================================
   Supabase — tarifs, demandes, messages, devis, disponibilités
   Montants : la base stocke l’USD en centimes, le CDF en francs.
   ========================================================= */

type Row = Record<string, unknown>;
const toDb = (amount: number, currency: string) => Math.round(amount * (currency === "USD" ? 100 : 1));
const fromDb = (amount: unknown, currency: unknown) => Number(amount) / (currency === "USD" ? 100 : 1);

export async function loadStep4(sb: SupabaseClient, vendorId: string, inquiryIds: string[]): Promise<Pick<EspaceData, "packages" | "options" | "promotions" | "messages" | "quickReplies" | "quotes" | "availability">> {
  const [pk, op, pr, ms, qr, qt, av] = await Promise.all([
    sb.from("packages").select("*").eq("vendor_id", vendorId).order("sort"),
    sb.from("package_options").select("*").eq("vendor_id", vendorId).order("sort"),
    sb.from("promotions").select("*").eq("vendor_id", vendorId).order("starts_at"),
    inquiryIds.length ? sb.from("messages").select("*").in("inquiry_id", inquiryIds).order("created_at") : Promise.resolve({ data: [] }),
    sb.from("quick_replies").select("*").eq("vendor_id", vendorId).order("sort"),
    sb.from("quotes").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }),
    sb.from("availability").select("*").eq("vendor_id", vendorId),
  ]);
  const rows = (r: { data: unknown }) => (r.data ?? []) as Row[];
  return {
    packages: rows(pk).map((p) => ({
      id: String(p.id), name: String(p.name), description: String(p.description ?? ""), priceMode: p.price_mode as Package["priceMode"], amount: fromDb(p.price_amount, p.currency),
      currency: p.currency as Package["currency"], duration: String(p.duration_label ?? ""), includes: p.includes as string[], excludes: p.excludes as string[], featured: !!p.is_featured, visible: !!p.is_visible,
    })),
    options: rows(op).map((o) => ({ id: String(o.id), name: String(o.name), amount: fromDb(o.price_amount, o.currency), currency: o.currency as PackageOption["currency"], packageId: (o.package_id as string) ?? undefined })),
    promotions: rows(pr).map((p) => ({ id: String(p.id), label: String(p.label), kind: p.kind as Promotion["kind"], discount: p.discount as Promotion["discount"], value: Number(p.value), startsAt: String(p.starts_at), endsAt: String(p.ends_at), packageId: (p.package_id as string) ?? undefined })),
    messages: rows(ms).map((m) => ({ id: String(m.id), inquiryId: String(m.inquiry_id), sender: m.sender as Message["sender"], body: String(m.body ?? ""), quoteId: (m.quote_id as string) ?? undefined, createdAt: String(m.created_at) })),
    quickReplies: rows(qr).map((q) => ({ id: String(q.id), title: String(q.title), body: String(q.body) })),
    quotes: rows(qt).map((q) => ({
      id: String(q.id), inquiryId: String(q.inquiry_id), number: String(q.number), packageId: (q.package_id as string) ?? undefined,
      lines: ((q.items as { label: string; qty: number; unit_amount: number }[]) ?? []).map((l) => ({ label: l.label, qty: l.qty, unit: fromDb(l.unit_amount, q.currency) })),
      discount: fromDb(q.discount, q.currency), currency: q.currency as Quote["currency"], validUntil: String(q.valid_until), notes: String(q.notes ?? ""),
      status: q.status as Quote["status"], sentAt: (q.sent_at as string) ?? undefined, createdAt: String(q.created_at),
    })),
    availability: Object.fromEntries(rows(av).map((a) => [String(a.day), { status: a.status as DayEntry["status"], inquiryId: (a.inquiry_id as string) ?? undefined, note: (a.note as string) ?? undefined }])),
  };
}

/** Champs supplémentaires des demandes lus depuis la table inquiries */
export function mapInquiryExtras(q: Row): Partial<Inquiry> {
  return { email: (q.email as string) ?? undefined, phone: (q.phone as string) ?? undefined, contactPref: (q.contact_pref as Inquiry["contactPref"]) ?? undefined, venue: (q.venue as string) ?? undefined, lostReason: (q.lost_reason as string) ?? undefined };
}

export const remote4 = {
  async savePackage(vendorId: string | undefined, p: Package, sort: number) {
    const sb = getSupabase(); if (!sb || !vendorId) return null;
    const { error } = await sb.from("packages").upsert({
      id: p.id, vendor_id: vendorId, name: p.name, description: p.description || null, price_mode: p.priceMode, price_amount: toDb(p.amount, p.currency), currency: p.currency,
      duration_label: p.duration || null, includes: p.includes, excludes: p.excludes, is_featured: p.featured, is_visible: p.visible, sort,
    });
    return error ? (error.message.includes("QUOTA_PACKAGES") ? "Nombre maximal de forfaits atteint pour votre offre." : "Le forfait n’a pas pu être enregistré.") : null;
  },
  /** Un seul forfait « le plus populaire » : on retire d’abord l’ancien (index unique en base) */
  async setFeatured(vendorId: string | undefined, id: string | null) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("packages").update({ is_featured: false }).eq("vendor_id", vendorId).eq("is_featured", true);
    if (id) await sb.from("packages").update({ is_featured: true }).eq("id", id);
  },
  async deletePackage(id: string) { const sb = getSupabase(); if (sb) await sb.from("packages").delete().eq("id", id); },
  async saveOption(vendorId: string | undefined, o: PackageOption) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("package_options").upsert({ id: o.id, vendor_id: vendorId, package_id: o.packageId ?? null, name: o.name, price_amount: toDb(o.amount, o.currency), currency: o.currency });
  },
  async deleteOption(id: string) { const sb = getSupabase(); if (sb) await sb.from("package_options").delete().eq("id", id); },
  async savePromotion(vendorId: string | undefined, p: Promotion) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("promotions").upsert({ id: p.id, vendor_id: vendorId, package_id: p.packageId ?? null, kind: p.kind, label: p.label, discount: p.discount, value: p.value, starts_at: p.startsAt, ends_at: p.endsAt });
  },
  async deletePromotion(id: string) { const sb = getSupabase(); if (sb) await sb.from("promotions").delete().eq("id", id); },
  /** Le trigger sync_availability met le calendrier à jour côté base */
  async setStatus(id: string, status: InquiryStatus, lostReason?: string) {
    const sb = getSupabase(); if (!sb) return;
    await sb.from("inquiries").update({ status, lost_reason: lostReason ?? null }).eq("id", id);
  },
  async markRead(id: string) { const sb = getSupabase(); if (sb) await sb.from("inquiries").update({ unread_vendor: 0 }).eq("id", id); },
  async sendMessage(m: Message, userId: string) {
    const sb = getSupabase(); if (!sb) return;
    await sb.from("messages").insert({ id: m.id, inquiry_id: m.inquiryId, sender: "vendor", sender_id: userId, body: m.body, quote_id: m.quoteId ?? null });
  },
  async saveQuickReply(vendorId: string | undefined, r: QuickReply) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("quick_replies").upsert({ id: r.id, vendor_id: vendorId, title: r.title, body: r.body });
  },
  async deleteQuickReply(id: string) { const sb = getSupabase(); if (sb) await sb.from("quick_replies").delete().eq("id", id); },
  /** Enregistre le devis et son PDF (bucket privé) */
  async saveQuote(vendorId: string | undefined, q: Quote, total: number, pdf?: Blob) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    let pdfPath: string | null = null;
    if (pdf) {
      pdfPath = `${vendorId}/quotes/${q.id}.pdf`;
      await sb.storage.from("vendor-private").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: true });
    }
    await sb.from("quotes").upsert({
      id: q.id, vendor_id: vendorId, inquiry_id: q.inquiryId, number: q.number, package_id: q.packageId ?? null,
      items: q.lines.map((l) => ({ label: l.label, qty: l.qty, unit_amount: toDb(l.unit, q.currency) })), discount: toDb(q.discount, q.currency), total: toDb(total, q.currency),
      currency: q.currency, valid_until: q.validUntil, notes: q.notes || null, status: q.status, sent_at: q.sentAt ?? null, pdf_path: pdfPath,
    });
  },
  async setDay(vendorId: string | undefined, day: string, entry: DayEntry | null) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    if (!entry) await sb.from("availability").delete().eq("vendor_id", vendorId).eq("day", day);
    else await sb.from("availability").upsert({ vendor_id: vendorId, day, status: entry.status, inquiry_id: entry.inquiryId ?? null, note: entry.note ?? null });
  },
};
