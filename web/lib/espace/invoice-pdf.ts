"use client";

import type { Draft } from "@/lib/onboarding/types";
import { formatPrice } from "@/lib/utils";
import { PAYMENT_METHODS, PLANS, type Invoice } from "./types";

/* Facture d’abonnement NDOA Wedding (A4), générée avec pdf-lib et les polices standard */
export async function invoicePdf(inv: Invoice, vendor: Draft): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`Facture ${inv.number}`);
  doc.setAuthor("NDOA Wedding");
  doc.setLanguage("fr-FR");
  const [serif, sans, bold] = await Promise.all([doc.embedFont(StandardFonts.TimesRoman), doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const charset = new Set(sans.getCharacterSet());
  const t = (s: string) => [...s.replace(/[  ]/g, " ").replace(/−/g, "-")].map((c) => (charset.has(c.codePointAt(0)!) ? c : "?")).join("");

  const W = 595.28, H = 841.89, M = 48;
  const ink = rgb(0.06, 0.06, 0.07), muted = rgb(0.42, 0.4, 0.38), line = rgb(0.86, 0.83, 0.78), gold = rgb(0.77, 0.59, 0.35), goldInk = rgb(0.55, 0.25, 0.15), ivory = rgb(0.96, 0.94, 0.91);
  const page = doc.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, size: number, font = sans, color = ink) => page.drawText(t(s), { x, y, size, font, color });
  const right = (s: string, xr: number, size: number, font = sans, color = ink) => page.drawText(t(s), { x: xr - font.widthOfTextAtSize(t(s), size), y, size, font, color });
  const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00` : iso).toLocaleDateString("fr-FR");
  const money = (n: number) => t(formatPrice(n, inv.currency));

  page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: gold });
  // Logo NDOA Wedding (repli sur le nom en texte si l’image est indisponible)
  try {
    const png = await doc.embedPng(await (await fetch("/brand/ndoa-wedding.png")).arrayBuffer());
    const lh = 50, lw = (png.width / png.height) * lh;
    page.drawImage(png, { x: M, y: y - lh + 12, width: lw, height: lh });
  } catch { text("NDOA Wedding", M, 24, serif); }
  right("FACTURE", W - M, 11, bold, goldInk);
  y -= 18; right(`N° ${inv.number}`, W - M, 11, bold);
  y -= 14; right(`Émise le ${d(inv.paidAt ?? inv.createdAt)}`, W - M, 9.5, sans, muted);
  y -= 26; text("Les prestataires de mariage en RDC · Kinshasa · facturation@ndoa.cd", M, 9.5, sans, muted);

  y -= 40;
  page.drawRectangle({ x: M, y: y - 52, width: W - 2 * M, height: 66, color: ivory });
  text("FACTURÉ À", M + 16, 8, bold, goldInk);
  y -= 16; text(vendor.name, M + 16, 14, serif);
  y -= 16; text([vendor.city, vendor.contacts.email, vendor.contacts.phone && `${vendor.contacts.country} ${vendor.contacts.phone}`].filter(Boolean).join(" · "), M + 16, 9.5, sans, muted);

  y -= 50;
  text("DÉSIGNATION", M, 8, bold, muted); right("PÉRIODE", W - M - 140, 8, bold, muted); right("MONTANT", W - M, 8, bold, muted);
  y -= 10; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: ink });
  y -= 22;
  text(`Abonnement ${PLANS[inv.plan].name} · ${inv.months === 12 ? "12 mois (2 mois offerts)" : "1 mois"}`, M, 10.5);
  right(`${d(inv.periodStart)} – ${d(inv.periodEnd)}`, W - M - 140, 10);
  right(money(inv.amount), W - M, 10.5, bold);
  y -= 12; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: line });

  y -= 30;
  text("Total", W - M - 200, 13, bold); right(money(inv.amount), W - M, 17, serif, goldInk);
  y -= 22;
  text("Statut", W - M - 200, 10, sans, muted); right(inv.status === "paid" ? "Payée" : inv.status === "failed" ? "Échec du paiement" : inv.status === "refunded" ? "Remboursée" : "En attente", W - M, 10, bold, inv.status === "paid" ? rgb(0.16, 0.5, 0.3) : rgb(0.7, 0.2, 0.2));
  y -= 16;
  text("Moyen de paiement", W - M - 200, 10, sans, muted); right(PAYMENT_METHODS[inv.method].short, W - M, 10);

  y -= 60;
  text("Merci pour votre confiance. Pour toute question sur cette facture : facturation@ndoa.cd", M, 8.5, sans, muted);
  page.drawText(t(`Facture ${inv.number} · NDOA Wedding`), { x: M, y: 28, size: 8, font: sans, color: muted });
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}
