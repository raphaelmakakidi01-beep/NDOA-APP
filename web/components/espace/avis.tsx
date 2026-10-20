"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, Check, Copy, Link2, Mail, MessageCircle, MessageSquareQuote, Pencil, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardHeader, EmptyState, Skeleton, Stars, StatusTag, dateFr, timeAgo } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { reviewLink, useAccount } from "@/lib/espace/business5";
import type { Inquiry, Review, ReviewRequest } from "@/lib/espace/types";
import { cn } from "@/lib/utils";

const initials = (s: string) => s.split(/\s*&\s*|\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const daysLeft = (iso: string, now: number) => Math.ceil((new Date(iso).getTime() - now) / 86400_000);

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast.success("Lien copié"); }
  catch { toast.error("Copie impossible : sélectionnez le lien et copiez-le manuellement."); }
}
const waShare = (phone: string | undefined, couple: string, vendor: string, link: string) =>
  `https://wa.me/${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${couple.split(/\s*&\s*/)[0]}, encore merci de nous avoir fait confiance ! Votre avis compte beaucoup pour ${vendor} : ${link}`)}`;

/* ---------------------------------------------------------
   Carte d’un avis + réponse publique
   --------------------------------------------------------- */
function ReviewCard({ r }: { r: Review }) {
  const acc = useAccount();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.reply ?? "");
  const [busy, setBusy] = useState(false);
  const status = r.status === "pending" ? { label: "En vérification", tone: "muted" as const } : r.status === "hidden" ? { label: "Masqué par la modération", tone: "danger" as const } : null;

  const save = async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    if (await acc.reply(r.id, text)) setEditing(false);
    setBusy(false);
  };

  return (
    <motion.article layout className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <header className="flex items-start gap-3">
        {r.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
        ) : <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-lg text-gold-ink" aria-hidden>{initials(r.names)}</span>}
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
            {r.names}
            {r.verified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-ink"><BadgeCheck className="size-4" aria-hidden />Mariage vérifié</span>}
          </h3>
          <p className="text-[13px] text-muted">{[r.city, r.weddingDate && `mariage le ${dateFr(r.weddingDate, { day: "numeric", month: "long", year: "numeric" })}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <Stars value={r.rating} />
          <span className="text-xs text-muted">{timeAgo(r.createdAt)}</span>
        </div>
      </header>
      {status && <StatusTag tone={status.tone} className="mt-3">{status.label}</StatusTag>}
      <p className="mt-4 text-[15px] leading-relaxed">{r.text}</p>

      {editing ? (
        <div className="mt-5 grid gap-3 border-l-2 border-gold pl-4">
          <Field label="Votre réponse publique" counter={{ value: text.length, max: 1000 }} hint="Visible par tous sous l’avis. Remerciez, et répondez aux critiques sans vous justifier.">
            {(a) => <Textarea id={a.id} aria-describedby={a.describedBy} className="min-h-28" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} autoFocus />}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setText(r.reply ?? ""); }}>Annuler</Button>
            <Button size="sm" onClick={save} loading={busy} disabled={text.trim().length < 2}><Send aria-hidden />Publier la réponse</Button>
          </div>
        </div>
      ) : r.reply ? (
        <div className="mt-5 rounded-2xl bg-surface-2 p-4">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-ink">Votre réponse{r.repliedAt && <span className="ml-2 font-normal normal-case tracking-normal text-muted">{timeAgo(r.repliedAt)}</span>}</p>
            <div className="flex">
              <button type="button" onClick={() => setEditing(true)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-text" aria-label={`Modifier la réponse à ${r.names}`}><Pencil className="size-4" aria-hidden /></button>
              <button type="button" onClick={() => { void acc.reply(r.id, null); setText(""); }} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer la réponse à ${r.names}`}><Trash2 className="size-4" aria-hidden /></button>
            </div>
          </div>
          <p className="text-[15px] leading-relaxed text-muted">{r.reply}</p>
        </div>
      ) : r.status !== "hidden" && (
        <Button variant="outline" size="sm" className="mt-5" onClick={() => setEditing(true)}><MessageSquareQuote aria-hidden />Répondre publiquement</Button>
      )}
    </motion.article>
  );
}

/* ---------------------------------------------------------
   Lien de collecte
   --------------------------------------------------------- */
function RequestDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Inquiry }) {
  const { data, vendor } = useEspace();
  const acc = useAccount();
  const eligible = data.inquiries.filter((q) => q.status === "confirmed");
  const [inquiryId, setInquiryId] = useState(preset?.id ?? "");
  const [couple, setCouple] = useState(preset?.couple ?? "");
  const [channel, setChannel] = useState<ReviewRequest["channel"]>(preset?.phone ? "whatsapp" : preset?.email ? "email" : "lien");
  const [created, setCreated] = useState<ReviewRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const q = data.inquiries.find((x) => x.id === inquiryId);

  const create = async () => {
    const name = (q?.couple ?? couple).trim();
    if (name.length < 3) { setErr("Indiquez le nom des mariés."); return; }
    setBusy(true);
    const rq = await acc.createRequest({ inquiryId: q?.id, couple: name, channel, sentTo: channel === "whatsapp" ? q?.phone : channel === "email" ? q?.email : undefined });
    setBusy(false);
    if (!rq) return;
    setCreated(rq);
    const link = reviewLink(rq.token);
    if (channel === "whatsapp") window.open(waShare(q?.phone, name, vendor.name, link), "_blank", "noopener");
    if (channel === "email") location.href = `mailto:${q?.email ?? ""}?subject=${encodeURIComponent(`Votre avis sur ${vendor.name}`)}&body=${encodeURIComponent(`Bonjour,\n\nMerci encore pour votre confiance. Pourriez-vous partager votre expérience ? Cela prend deux minutes :\n${link}\n\nÀ très bientôt,\n${vendor.name}`)}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={created ? "Lien prêt" : "Demander un avis"} description={created ? "Valable 60 jours, utilisable une seule fois." : "Un lien unique, valable 60 jours. Les avis liés à un mariage confirmé portent le badge « Mariage vérifié »."}
      footer={created ? <Button onClick={onClose}>Terminé</Button> : <><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={create} loading={busy}><Link2 aria-hidden />Créer le lien</Button></>}>
      {created ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface-2 p-2 pl-4">
            <code className="min-w-0 flex-1 truncate text-sm">{reviewLink(created.token)}</code>
            <Button size="sm" variant="outline" onClick={() => copy(reviewLink(created.token))}><Copy aria-hidden />Copier</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><a href={waShare(q?.phone, created.couple, vendor.name, reviewLink(created.token))} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden />Envoyer sur WhatsApp</a></Button>
            <Button asChild size="sm" variant="ghost"><Link href={`/avis/${created.token}`} target="_blank">Voir le formulaire du couple</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          <Field label="Mariage" hint={eligible.length ? "Seuls les mariages confirmés donnent un avis vérifié." : "Aucun mariage confirmé pour l’instant : créez un lien libre."}>
            {(a) => (
              <Select id={a.id} aria-describedby={a.describedBy} value={inquiryId} onChange={(e) => { setInquiryId(e.target.value); setErr(""); const x = data.inquiries.find((i) => i.id === e.target.value); setChannel(x?.phone ? "whatsapp" : x?.email ? "email" : "lien"); }}>
                <option value="">Autre couple (lien libre)</option>
                {eligible.map((x) => <option key={x.id} value={x.id}>{x.couple} · {dateFr(x.weddingDate, { day: "numeric", month: "short", year: "numeric" })}</option>)}
              </Select>
            )}
          </Field>
          {!q && <Field label="Prénoms des mariés" error={err}>{(a) => <Input id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} value={couple} onChange={(e) => { setCouple(e.target.value); setErr(""); }} placeholder="Ex. Lydie & Marc" maxLength={60} />}</Field>}
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold">Envoi</span>
            <Segmented layoutId="rq-channel" label="Moyen d’envoi" value={channel} onChange={setChannel}
              options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "E-mail" }, { value: "lien", label: "Copier le lien" }]} />
            {channel === "whatsapp" && !q?.phone && <p className="text-[13px] text-muted">WhatsApp s’ouvrira sans destinataire : choisissez la conversation du couple.</p>}
            {channel === "email" && !q?.email && <p className="text-[13px] text-muted">Votre messagerie s’ouvrira : ajoutez l’adresse du couple.</p>}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */
type Filter = "all" | "unanswered" | "positive" | "critical";

export function Avis() {
  const { data } = useEspace();
  const [now] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("all");
  const [dialog, setDialog] = useState<{ preset?: Inquiry } | null>(null);
  const reviews = useMemo(() => [...data.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.reviews]);
  const published = reviews.filter((r) => (r.status ?? "published") === "published");
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: published.filter((r) => r.rating === n).length }));
  const answered = published.filter((r) => r.reply).length;
  const today = new Date(now).toISOString().slice(0, 10);
  const asked = new Set(data.reviewRequests.map((r) => r.inquiryId).filter(Boolean));
  const reviewedNames = new Set(data.reviews.map((r) => r.names));
  const suggestions = data.inquiries.filter((q) => q.status === "confirmed" && q.weddingDate < today && !asked.has(q.id) && !reviewedNames.has(q.couple));
  const shown = reviews.filter((r) => filter === "all" || (filter === "unanswered" ? !r.reply : filter === "positive" ? r.rating >= 4 : r.rating <= 3));
  const fmt = (x: number) => x.toFixed(1).replace(".", ",");

  return (
    <div className="grid grid-cols-1 gap-8">
      <div>
        <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Avis</em></h1>
        <p className="mt-1 text-muted">Ce que disent vos mariés. Les avis sont publics et ne peuvent pas être modifiés, mais vous pouvez y répondre.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card aria-labelledby="note-h">
          <h2 id="note-h" className="sr-only">Note globale</h2>
          {published.length ? (
            <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="text-center sm:pr-6">
                <p className="font-display text-6xl leading-none tabular-nums">{fmt(avg)}</p>
                <Stars value={avg} className="mt-2 [&_svg]:size-4" />
                <p className="mt-1 text-sm text-muted">{published.length} avis</p>
              </div>
              <div className="grid gap-2">
                {dist.map((d) => (
                  <div key={d.n} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-3 text-sm">
                    <span className="tabular-nums text-muted">{d.n} ★</span>
                    <span className="h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={`${d.count} avis à ${d.n} étoiles`}>
                      <motion.span className="block h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(d.count / published.length) * 100}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
                    </span>
                    <span className="text-right tabular-nums text-muted">{d.count}</span>
                  </div>
                ))}
              </div>
              <dl className="col-span-full grid grid-cols-2 gap-3 border-t border-line pt-5 text-sm">
                <div><dt className="text-muted">Avis avec réponse</dt><dd className="font-display text-2xl tabular-nums">{Math.round((answered / published.length) * 100)} %</dd></div>
                <div><dt className="text-muted">Moyenne de la catégorie</dt><dd className="font-display text-2xl tabular-nums">{data.benchmark.rating ? fmt(data.benchmark.rating) : "—"}{data.benchmark.rating > 0 && avg >= data.benchmark.rating && <span className="ml-2 align-middle text-xs font-semibold text-success">vous êtes au-dessus</span>}</dd></div>
              </dl>
            </div>
          ) : (
            <EmptyState icon={<MessageSquareQuote />} title="Pas encore d’avis" className="border-0 py-6">Les vitrines avec au moins 3 avis reçoivent 2,5 fois plus de demandes. Envoyez votre lien à vos derniers mariés.</EmptyState>
          )}
        </Card>

        <Card aria-labelledby="collect-h">
          <CardHeader id="collect-h" title="Collecter des avis" sub="Un lien unique à envoyer à vos mariés après la fête."
            action={<Button size="sm" onClick={() => setDialog({})}><Link2 aria-hidden />Créer un lien</Button>} />
          {suggestions.length > 0 && (
            <div className="mb-4 grid gap-2">
              {suggestions.map((q) => (
                <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/40 bg-gold/8 p-3">
                  <p className="min-w-0 flex-1 text-sm"><strong>{q.couple}</strong> se sont mariés {timeAgo(`${q.weddingDate}T12:00`)}. C’est le bon moment pour leur demander un avis.</p>
                  <Button size="sm" variant="outline" onClick={() => setDialog({ preset: q })}><Send aria-hidden />Demander</Button>
                </div>
              ))}
            </div>
          )}
          {data.reviewRequests.length === 0 ? (
            <p className="text-sm text-muted">Aucun lien envoyé pour l’instant.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.reviewRequests.slice(0, 6).map((rq) => {
                const left = daysLeft(rq.expiresAt, now);
                const st = rq.usedAt ? { label: "Avis reçu", tone: "success" as const } : left <= 0 ? { label: "Expiré", tone: "danger" as const } : { label: `En attente · ${left} j`, tone: "gold" as const };
                return (
                  <li key={rq.token} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">{rq.channel === "whatsapp" ? <MessageCircle className="size-4" aria-hidden /> : rq.channel === "email" ? <Mail className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{rq.couple}</p>
                      <p className="text-[13px] text-muted">Envoyé {timeAgo(rq.createdAt)}</p>
                    </div>
                    <StatusTag tone={st.tone}>{st.label}</StatusTag>
                    {!rq.usedAt && left > 0 && <button type="button" onClick={() => copy(reviewLink(rq.token))} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Copier le lien de ${rq.couple}`}><Copy className="size-4" aria-hidden /></button>}
                    {rq.usedAt && <Check className="size-4 text-success" aria-hidden />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {reviews.length > 0 && (
        <section aria-labelledby="list-h" className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="list-h" className="font-display text-2xl">Tous les avis</h2>
            <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0" role="group" aria-label="Filtrer les avis">
              {([["all", "Tous", reviews.length], ["unanswered", "Sans réponse", reviews.filter((r) => !r.reply).length], ["positive", "4 et 5 étoiles", reviews.filter((r) => r.rating >= 4).length], ["critical", "3 étoiles et moins", reviews.filter((r) => r.rating <= 3).length]] as const).map(([id, label, n]) => (
                <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
                  className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors", filter === id ? "border-gold bg-gold text-on-gold" : "border-line text-muted hover:border-gold hover:text-text")}>
                  {label}<span className="tabular-nums opacity-70">{n}</span>
                </button>
              ))}
            </div>
          </div>
          {shown.length ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{shown.map((r) => <ReviewCard key={r.id} r={r} />)}</div>
          ) : (
            <EmptyState icon={<Check />} title={filter === "unanswered" ? "Vous avez répondu à tout le monde" : "Aucun avis dans ce filtre"}>{filter === "unanswered" ? "Bravo : répondre à chaque avis montre aux couples que vous êtes attentif." : undefined}</EmptyState>
          )}
        </section>
      )}

      {dialog && <RequestDialog key={dialog.preset?.id ?? "new"} open onClose={() => setDialog(null)} preset={dialog.preset} />}
    </div>
  );
}

export function AvisSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8" aria-busy="true" aria-label="Chargement des avis">
      <Skeleton className="h-14 w-40" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /></div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-52 rounded-3xl" />)}</div>
    </div>
  );
}
