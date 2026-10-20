"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Popover } from "radix-ui";
import { ArrowLeft, CalendarDays, Download, FileText, Mail, MapPin, MessageCircle, Pencil, Phone, Plus, Send, Trash2, Users, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Card, EmptyState, Skeleton, StatusTag, dateFr } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { fillTemplate, useBusiness } from "@/lib/espace/business";
import { downloadBlob, quotePdf } from "@/lib/espace/quote-pdf";
import { quoteTotal, type Inquiry, type Message, type Quote, type QuickReply } from "@/lib/espace/types";
import { cn, formatPrice, uid } from "@/lib/utils";
import { StatusMenu, useStatusFlow } from "./status";
import { QuoteBuilder } from "./quote-builder";

const time = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso: string) => {
  const d = new Date(iso), t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Aujourd’hui";
  if (d.toDateString() === y.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};
const QUOTE_STATUS: Record<Quote["status"], { label: string; tone: "muted" | "gold" | "success" | "danger" }> = {
  draft: { label: "Brouillon", tone: "muted" }, sent: { label: "Envoyé", tone: "gold" }, accepted: { label: "Accepté", tone: "success" }, declined: { label: "Refusé", tone: "danger" },
};

function useDownload(inquiry: Inquiry) {
  const { vendor } = useEspace();
  return async (q: Quote) => {
    try { downloadBlob(await quotePdf(q, vendor, inquiry), `Devis-${q.number}.pdf`); }
    catch { toast.error("Le PDF n’a pas pu être généré."); }
  };
}

/* ---------------------------------------------------------
   Bulles
   --------------------------------------------------------- */
function QuoteBubble({ quote, inquiry }: { quote: Quote; inquiry: Inquiry }) {
  const download = useDownload(inquiry);
  return (
    <div className="mx-auto w-full max-w-sm rounded-2xl border border-gold/50 bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-ink"><FileText className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Devis {quote.number}</p>
          <p className="text-[13px] text-muted">Valable jusqu’au {dateFr(quote.validUntil)}</p>
        </div>
        <span className="font-display text-xl tabular-nums text-gold-ink">{formatPrice(quoteTotal(quote), quote.currency)}</span>
      </div>
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => download(quote)}><Download aria-hidden />Télécharger le PDF</Button>
    </div>
  );
}

function Bubble({ m, inquiry }: { m: Message; inquiry: Inquiry }) {
  const { data } = useEspace();
  if (m.sender === "system") {
    const quote = m.quoteId ? data.quotes.find((q) => q.id === m.quoteId) : undefined;
    return (
      <li className="grid gap-2 py-1">
        <p className="text-center text-xs text-muted"><span className="rounded-full bg-surface-2 px-3 py-1">{m.body} · {time(m.createdAt)}</span></p>
        {quote && <QuoteBubble quote={quote} inquiry={inquiry} />}
      </li>
    );
  }
  const mine = m.sender === "vendor";
  return (
    <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-3xl px-4 py-2.5 sm:max-w-[70%]", mine ? "rounded-br-lg bg-gold/18 text-text" : "rounded-bl-lg bg-surface-2")}>
        <p className="sr-only">{mine ? "Vous" : inquiry.couple} :</p>
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.body}</p>
        <p className={cn("mt-1 text-[11px] text-muted", mine && "text-right")}>{time(m.createdAt)}</p>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------
   Réponses rapides
   --------------------------------------------------------- */
function QuickRepliesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useEspace();
  const biz = useBusiness();
  const [edit, setEdit] = useState<QuickReply | null>(null);
  const [err, setErr] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setEdit(null); onClose(); } }} title="Réponses rapides" description="Utilisez {prenoms} et {date} : ils sont remplacés par les prénoms du couple et la date du mariage.">
      {edit ? (
        <form className="grid gap-4" onSubmit={(e) => {
          e.preventDefault();
          if (!edit.title.trim() || edit.body.trim().length < 5) { setErr("Renseignez un titre et un message."); return; }
          biz.saveQuickReply({ ...edit, title: edit.title.trim(), body: edit.body.trim() }); setEdit(null);
        }}>
          <Field label="Titre" error={err && !edit.title.trim() ? err : undefined}>{(a) => <Input id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} value={edit.title} maxLength={30} onChange={(e) => { setErr(""); setEdit({ ...edit, title: e.target.value }); }} autoFocus />}</Field>
          <Field label="Message" error={err && edit.title.trim() ? err : undefined}>{(a) => <Textarea id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} value={edit.body} maxLength={600} onChange={(e) => { setErr(""); setEdit({ ...edit, body: e.target.value }); }} />}</Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
        </form>
      ) : (
        <div className="grid gap-3">
          <ul className="divide-y divide-line">
            {data.quickReplies.map((r) => (
              <li key={r.id} className="flex items-start gap-2 py-3">
                <div className="min-w-0 flex-1"><p className="font-semibold">{r.title}</p><p className="line-clamp-2 text-sm text-muted">{r.body}</p></div>
                <button type="button" onClick={() => setEdit(r)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Modifier ${r.title}`}><Pencil className="size-4" aria-hidden /></button>
                <button type="button" onClick={() => biz.deleteQuickReply(r.id)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer ${r.title}`}><Trash2 className="size-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="justify-self-start" onClick={() => setEdit({ id: uid(), title: "", body: "" })}><Plus aria-hidden />Nouvelle réponse</Button>
        </div>
      )}
    </Dialog>
  );
}

function Composer({ inquiry }: { inquiry: Inquiry }) {
  const { data } = useEspace();
  const biz = useBusiness();
  const [text, setText] = useState("");
  const [manage, setManage] = useState(false);
  const [open, setOpen] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ta.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(200, el.scrollHeight)}px`; } }, [text]);
  const send = () => { if (!text.trim()) return; biz.sendMessage(inquiry.id, text); setText(""); ta.current?.focus(); };
  const insert = (r: QuickReply) => { setText(fillTemplate(r.body, inquiry)); setOpen(false); setTimeout(() => ta.current?.focus(), 0); };

  return (
    <div className="border-t border-line bg-surface p-3 sm:p-4">
      {data.quickReplies.length > 0 && !text && (
        <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Réponses rapides">
          {data.quickReplies.map((r) => (
            <button key={r.id} type="button" onClick={() => insert(r)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] font-medium text-muted hover:border-gold hover:text-text">
              <Zap className="size-3.5 text-gold-ink" aria-hidden />{r.title}
            </button>
          ))}
        </div>
      )}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-gold hover:text-text" aria-label="Insérer une réponse rapide"><Zap className="size-4" aria-hidden /></Popover.Trigger>
          <Popover.Portal>
            <Popover.Content side="top" align="start" sideOffset={8} className="z-50 w-[min(92vw,340px)] rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
              {data.quickReplies.map((r) => (
                <button key={r.id} type="button" onClick={() => insert(r)} className="block w-full rounded-xl px-3 py-2.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none">
                  <span className="block text-sm font-semibold">{r.title}</span><span className="line-clamp-1 text-[13px] text-muted">{fillTemplate(r.body, inquiry)}</span>
                </button>
              ))}
              <button type="button" onClick={() => { setOpen(false); setManage(true); }} className="mt-1 block w-full rounded-xl border-t border-line px-3 py-2.5 text-left text-sm font-semibold text-gold-ink hover:bg-surface-2">Gérer les réponses rapides</button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <label className="sr-only" htmlFor="composer">Votre message à {inquiry.couple}</label>
        <textarea id="composer" ref={ta} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrire un message…" maxLength={2000}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          className="max-h-[200px] min-h-12 flex-1 resize-none rounded-3xl border border-line-strong bg-surface px-4 py-3 text-[15px] leading-snug focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
        <Button type="submit" size="icon" className="size-12" disabled={!text.trim()} aria-label="Envoyer"><Send aria-hidden /></Button>
      </form>
      <p className="mt-1.5 hidden pl-14 text-xs text-muted sm:block">Entrée pour envoyer · Maj + Entrée pour aller à la ligne</p>
      <QuickRepliesDialog open={manage} onClose={() => setManage(false)} />
    </div>
  );
}

/* ---------------------------------------------------------
   Panneau de détails
   --------------------------------------------------------- */
function Details({ q, onQuote, onEditQuote }: { q: Inquiry; onQuote: () => void; onEditQuote: (x: Quote) => void }) {
  const { data } = useEspace();
  const download = useDownload(q);
  const quotes = data.quotes.filter((x) => x.inquiryId === q.id);
  const day = data.availability[q.weddingDate];
  const dayInfo = !day ? { label: "Date libre", tone: "success" as const } : day.inquiryId === q.id
    ? { label: day.status === "booked" ? "Réservée pour ce couple" : "En option pour ce couple", tone: "gold" as const }
    : { label: day.status === "booked" ? "Déjà réservée" : day.status === "blocked" ? "Bloquée" : "En option (autre couple)", tone: "danger" as const };
  const rows = [
    { icon: CalendarDays, label: "Mariage", value: dateFr(q.weddingDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
    { icon: MapPin, label: "Lieu", value: [q.venue, q.city].filter(Boolean).join(", ") },
    q.guests && { icon: Users, label: "Invités", value: String(q.guests) },
    q.budget && { icon: Wallet, label: "Budget", value: formatPrice(q.budget, "USD") },
    q.packageName && { icon: FileText, label: "Forfait souhaité", value: q.packageName },
  ].filter(Boolean) as { icon: typeof MapPin; label: string; value: string }[];

  return (
    <div className="grid content-start gap-4">
      <Card className="p-5 sm:p-5">
        <dl className="grid gap-3.5">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-3">
              <r.icon className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />
              <div className="min-w-0"><dt className="text-xs text-muted">{r.label}</dt><dd className="text-[15px] first-letter:uppercase">{r.value}</dd></div>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
          <span className="text-sm text-muted">Calendrier</span>
          <Link href={`/espace/calendrier?mois=${q.weddingDate.slice(0, 7)}`} className="rounded-md hover:opacity-80"><StatusTag tone={dayInfo.tone}>{dayInfo.label}</StatusTag></Link>
        </div>
        {q.lostReason && <p className="mt-3 text-sm text-muted">Raison de la perte : {q.lostReason}</p>}
      </Card>

      <Card className="p-5 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl">Devis</h2>
          {q.status !== "lost" && <Button size="sm" onClick={onQuote}><Plus aria-hidden />Créer</Button>}
        </div>
        {quotes.length === 0 ? (
          <p className="text-sm text-muted">Aucun devis. Un devis envoyé en moins de 24 h double vos chances de signer.</p>
        ) : (
          <ul className="grid gap-2">
            {quotes.map((x) => (
              <li key={x.id} className="flex items-center gap-2 rounded-2xl border border-line p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{x.number}<StatusTag tone={QUOTE_STATUS[x.status].tone}>{QUOTE_STATUS[x.status].label}</StatusTag></p>
                  <p className="text-[13px] tabular-nums text-muted">{formatPrice(quoteTotal(x), x.currency)}</p>
                </div>
                {x.status === "draft" && <button type="button" onClick={() => onEditQuote(x)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Modifier le devis ${x.number}`}><Pencil className="size-4" aria-hidden /></button>}
                <button type="button" onClick={() => download(x)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Télécharger le devis ${x.number}`}><Download className="size-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------
   Fil de discussion
   --------------------------------------------------------- */
export function Thread({ id }: { id: string }) {
  const { data, typing } = useEspace();
  const biz = useBusiness();
  const { request, dialogs } = useStatusFlow();
  const [quote, setQuote] = useState<Quote | "new" | null>(null);
  const [pane, setPane] = useState<"messages" | "details">("messages");
  const list = useRef<HTMLDivElement>(null);
  const q = data.inquiries.find((x) => x.id === id);
  const msgs = data.messages.filter((m) => m.inquiryId === id);
  const isTyping = !!typing[id];

  const markRead = biz.markRead;
  const unread = q?.unread;
  useEffect(() => { if (unread) markRead(id); }, [id, unread, markRead]);
  useLayoutEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, isTyping, pane]);

  if (!q) {
    return (
      <EmptyState icon={<MessageCircle />} title="Demande introuvable" action={<Button asChild variant="outline"><Link href="/espace/demandes">Retour aux demandes</Link></Button>}>
        Cette demande a peut-être été supprimée, ou le lien est incomplet.
      </EmptyState>
    );
  }

  const digits = (q.phone ?? "").replace(/\D/g, "");
  const first = q.couple.split(/\s*(?:&|et)\s*/)[0];
  const wa = `https://wa.me/${digits}?text=${encodeURIComponent(`Bonjour ${first}, je reviens vers vous au sujet de votre mariage du ${dateFr(q.weddingDate)} (demande reçue sur NDOA).`)}`;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/espace/demandes" className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-gold hover:text-text" aria-label="Retour aux demandes"><ArrowLeft className="size-4" aria-hidden /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 font-display text-2xl leading-tight sm:truncate sm:text-3xl">{q.couple}</h1>
          <p className="text-[13px] text-muted">{dateFr(q.weddingDate, { day: "numeric", month: "long", year: "numeric" })} · {q.city}{q.contactPref && ` · préfère ${q.contactPref === "whatsapp" ? "WhatsApp" : q.contactPref === "call" ? "un appel" : "l’e-mail"}`}</p>
        </div>
        <StatusMenu id={q.id} status={q.status} onChange={request} />
      </div>

      <div className="flex flex-wrap gap-2">
        {digits && <Button asChild size="sm"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden />Continuer sur WhatsApp</a></Button>}
        {digits && <Button asChild size="sm" variant="outline"><a href={`tel:+${digits}`}><Phone aria-hidden />Appeler</a></Button>}
        {q.email && <Button asChild size="sm" variant="outline"><a href={`mailto:${q.email}?subject=${encodeURIComponent(`Votre mariage du ${dateFr(q.weddingDate)}`)}`}><Mail aria-hidden />E-mail</a></Button>}
        {q.status !== "lost" && <Button size="sm" variant="outline" onClick={() => setQuote("new")} className="lg:hidden"><FileText aria-hidden />Créer un devis</Button>}
      </div>

      <Segmented layoutId="thread-pane" label="Affichage" className="w-full lg:hidden" value={pane} onChange={setPane} options={[{ value: "messages", label: "Messages" }, { value: "details", label: "Détails et devis" }]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-label="Conversation" className={cn("flex h-[calc(100dvh-27rem)] min-h-[340px] flex-col overflow-hidden rounded-3xl border border-line bg-surface lg:h-[calc(100dvh-15rem)]", pane !== "messages" && "hidden lg:flex")}>
          <div ref={list} className="flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite" aria-relevant="additions">
            <ol className="grid gap-2.5">
              {msgs.map((m, i) => {
                const dl = dayLabel(m.createdAt);
                const sep = i === 0 || dl !== dayLabel(msgs[i - 1].createdAt);
                return (
                  <FragmentWithDay key={m.id} label={sep ? dl : undefined}>
                    <Bubble m={m} inquiry={q} />
                  </FragmentWithDay>
                );
              })}
              {isTyping && (
                <li className="flex"><span className="inline-flex items-center gap-1 rounded-3xl rounded-bl-lg bg-surface-2 px-4 py-3" role="status" aria-label={`${q.couple} écrit…`}>
                  {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 120}ms` }} aria-hidden />)}
                </span></li>
              )}
            </ol>
          </div>
          {q.status === "lost"
            ? <p className="border-t border-line px-4 py-3 text-center text-sm text-muted">Demande marquée perdue. Changez son statut pour reprendre la conversation.</p>
            : <Composer inquiry={q} />}
        </section>
        <aside aria-label="Détails de la demande" className={cn(pane !== "details" && "hidden lg:block")}>
          <Details q={q} onQuote={() => setQuote("new")} onEditQuote={setQuote} />
        </aside>
      </div>

      {quote && <QuoteBuilder inquiry={q} initial={quote === "new" ? undefined : quote} onClose={() => setQuote(null)} />}
      {dialogs}
    </div>
  );
}

function FragmentWithDay({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <>
      {label && <li className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted first-letter:uppercase" role="separator">{label}</li>}
      {children}
    </>
  );
}

export function ThreadSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4" aria-busy="true" aria-label="Chargement de la conversation">
      <div className="flex items-center gap-3"><Skeleton className="size-10 rounded-full" /><Skeleton className="h-10 w-64" /></div>
      <div className="flex gap-2"><Skeleton className="h-9 w-52 rounded-full" /><Skeleton className="h-9 w-28 rounded-full" /></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><Skeleton className="h-[520px] rounded-3xl" /><Skeleton className="hidden h-[520px] rounded-3xl lg:block" /></div>
    </div>
  );
}
