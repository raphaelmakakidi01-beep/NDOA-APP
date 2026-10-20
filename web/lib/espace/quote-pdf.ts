"use client";

import type { Draft } from "@/lib/onboarding/types";
import { formatPrice } from "@/lib/utils";
import { quoteTotal, type Inquiry, type Quote } from "./types";

/* =========================================================
   Devis PDF (A4) généré dans le navigateur avec pdf-lib.
   Polices standard PDF : aucun fichier à télécharger.
   ========================================================= */

const A4 = { w: 595.28, h: 841.89 };
const M = 48;

export async function quotePdf(q: Quote, vendor: Draft, inquiry: Inquiry): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(`Devis ${q.number} — ${vendor.name}`);
  doc.setAuthor(vendor.name);
  doc.setCreator("NDOA Wedding");
  doc.setLanguage("fr-FR");

  const [serif, sans, bold] = await Promise.all([doc.embedFont(StandardFonts.TimesRoman), doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  // Les polices standard ne couvrent que le jeu WinAnsi : on remplace le reste
  const charset = new Set(sans.getCharacterSet());
  const t = (s: string) => [...s.replace(/[  ]/g, " ").replace(/−/g, "-")].map((c) => (charset.has(c.codePointAt(0)!) ? c : "?")).join("");

  const ink = rgb(0.06, 0.06, 0.07), muted = rgb(0.42, 0.4, 0.38), line = rgb(0.86, 0.83, 0.78), gold = rgb(0.83, 0.686, 0.416), goldInk = rgb(0.55, 0.42, 0.18), ivory = rgb(0.96, 0.94, 0.91);
  const money = (n: number) => t(formatPrice(n, q.currency));

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;
  const text = (s: string, x: number, size: number, font = sans, color = ink) => page.drawText(t(s), { x, y, size, font, color });
  const right = (s: string, xr: number, size: number, font = sans, color = ink) => page.drawText(t(s), { x: xr - font.widthOfTextAtSize(t(s), size), y, size, font, color });
  const wrap = (s: string, width: number, size: number, font = sans) => {
    const out: string[] = [];
    for (const para of t(s).split("\n")) {
      let cur = "";
      for (const w of para.split(" ")) {
        const next = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(next, size) > width && cur) { out.push(cur); cur = w; } else cur = next;
      }
      out.push(cur);
    }
    return out;
  };
  const ensure = (h: number) => { if (y - h < M + 40) { page = doc.addPage([A4.w, A4.h]); y = A4.h - M; } };

  // Bandeau
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: gold });
  y -= 10;
  text(vendor.name, M, 26, serif);
  right("DEVIS", A4.w - M, 11, bold, goldInk);
  y -= 18;
  text([vendor.tagline, vendor.city].filter(Boolean).join(" · "), M, 9.5, sans, muted);
  right(`N° ${q.number}`, A4.w - M, 11, bold);
  y -= 14;
  const c = vendor.contacts;
  text([c.phone && `${c.country} ${c.phone}`, c.email].filter(Boolean).join("   "), M, 9.5, sans, muted);
  right(`Émis le ${new Date(q.sentAt ?? q.createdAt).toLocaleDateString("fr-FR")}`, A4.w - M, 9.5, sans, muted);
  y -= 13;
  right(`Valable jusqu’au ${new Date(`${q.validUntil}T12:00`).toLocaleDateString("fr-FR")}`, A4.w - M, 9.5, sans, muted);

  // Client
  y -= 34;
  const boxH = 78;
  page.drawRectangle({ x: M, y: y - boxH + 14, width: A4.w - 2 * M, height: boxH, color: ivory });
  text("POUR", M + 16, 8, bold, goldInk);
  y -= 16;
  text(inquiry.couple, M + 16, 15, serif);
  y -= 18;
  const wd = new Date(`${inquiry.weddingDate}T12:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  text(`Mariage le ${wd}`, M + 16, 10);
  y -= 14;
  text([inquiry.venue, inquiry.city, inquiry.guests && `${inquiry.guests} invités`].filter(Boolean).join(" · "), M + 16, 10, sans, muted);

  // Tableau
  y -= 44;
  const cols = { qty: A4.w - M - 210, unit: A4.w - M - 100, total: A4.w - M };
  text("DÉSIGNATION", M, 8, bold, muted);
  right("QTÉ", cols.qty, 8, bold, muted);
  right("PRIX UNITAIRE", cols.unit, 8, bold, muted);
  right("TOTAL", cols.total, 8, bold, muted);
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.8, color: ink });
  for (const l of q.lines) {
    const rows = wrap(l.label, cols.qty - M - 50, 10.5);
    ensure(rows.length * 14 + 16);
    y -= 20;
    right(String(l.qty), cols.qty, 10.5);
    right(money(l.unit), cols.unit, 10.5);
    right(money(l.qty * l.unit), cols.total, 10.5, bold);
    rows.forEach((r, i) => { if (i) y -= 14; text(r, M, 10.5); });
    y -= 10;
    page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.5, color: line });
  }

  // Totaux
  ensure(90);
  const sub = q.lines.reduce((s, l) => s + l.qty * l.unit, 0);
  y -= 22;
  text("Sous-total", cols.unit - 110, 10, sans, muted); right(money(sub), cols.total, 10);
  if (q.discount > 0) { y -= 16; text("Remise", cols.unit - 110, 10, sans, muted); right(`- ${money(q.discount)}`, cols.total, 10); }
  y -= 14;
  page.drawLine({ start: { x: cols.unit - 110, y }, end: { x: A4.w - M, y }, thickness: 0.8, color: gold });
  y -= 22;
  text("Total", cols.unit - 110, 13, bold); right(money(quoteTotal(q)), cols.total, 17, serif, goldInk);

  // Conditions
  if (q.notes.trim()) {
    const rows = wrap(q.notes, A4.w - 2 * M, 10);
    ensure(rows.length * 14 + 40);
    y -= 44;
    text("CONDITIONS ET NOTES", M, 8, bold, goldInk);
    y -= 6;
    for (const r of rows) { y -= 14; ensure(14); text(r, M, 10, sans, muted); }
  }

  // Signature + pied de page
  ensure(80);
  y -= 50;
  text("Bon pour accord, date et signature :", M, 9.5, sans, muted);
  page.drawLine({ start: { x: M, y: y - 36 }, end: { x: M + 220, y: y - 36 }, thickness: 0.5, color: line });
  doc.getPages().forEach((p, i, all) => {
    p.drawText(t(`Devis ${q.number} · émis via NDOA Wedding, les prestataires de mariage en RDC`), { x: M, y: 28, size: 8, font: sans, color: muted });
    const n = t(`${i + 1} / ${all.length}`);
    p.drawText(n, { x: A4.w - M - sans.widthOfTextAtSize(n, 8), y: 28, size: 8, font: sans, color: muted });
  });

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
