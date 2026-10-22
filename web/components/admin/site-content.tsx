"use client";

import * as React from "react";
import { AlertTriangle, Eye, HelpCircle, Pencil, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { Segmented } from "@/components/ui/segmented";
import { deleteFaq, getContent, reorderFaqs, saveFaq, savePage, saveSetting, type Faq, type Setting, type SitePage } from "@/lib/admin/manage";
import { PUBLIC_SITE_URL } from "@/lib/config";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { dateInputClass } from "./pickers";
import { DragHandle, SortableList } from "./sortable";
import { ConfirmDialog, PageHeader, Panel, fmtDate } from "./ui";

type Tab = "pages" | "faq" | "texts";
const PAGE_PATH: Record<string, string> = { cgu: "/cgu", confidentialite: "/confidentialite", "mentions-legales": "/mentions-legales" };
const textareaClass = "w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

export function SiteContent() {
  const [tab, setTab] = React.useState<Tab>("pages");
  const [data, setData] = React.useState<{ pages: SitePage[]; faqs: Faq[]; settings: Setting[] } | null>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => { getContent().then((d) => { setData(d); setError(""); }).catch((e: Error) => setError(e.message)); }, []);
  React.useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Pages et contenus" sub="Pages légales, FAQ et textes du site public — publiés immédiatement" />
      <Segmented label="Rubrique" layoutId="content-tab" value={tab} onChange={setTab} className="mb-4 max-w-full overflow-x-auto"
        options={[{ value: "pages", label: "Pages légales" }, { value: "faq", label: <>FAQ{data ? ` (${data.faqs.length})` : ""}</> }, { value: "texts", label: "Textes du site" }]} />
      {error ? <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
        : !data ? <div className="skeleton h-96 rounded-2xl" />
          : tab === "pages" ? <Pages pages={data.pages} onSaved={load} />
            : tab === "faq" ? <Faqs faqs={data.faqs} onChanged={load} setFaqs={(faqs) => setData({ ...data, faqs })} />
              : <Texts settings={data.settings} onSaved={load} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
function Pages({ pages, onSaved }: { pages: SitePage[]; onSaved: () => void }) {
  const [slug, setSlug] = React.useState(pages[0]?.slug ?? "cgu");
  const page = pages.find((p) => p.slug === slug);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Page">
        {pages.map((p) => (
          <button key={p.slug} role="tab" aria-selected={p.slug === slug} type="button" onClick={() => setSlug(p.slug)}
            className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold", p.slug === slug ? "border-gold bg-gold/12 text-text" : "border-line text-muted hover:text-text")}>
            {p.title}{p.isPublished && <span className="size-1.5 rounded-full bg-success" aria-label="publiée" />}
          </button>
        ))}
      </div>
      {page && <PageEditor key={page.slug} page={page} onSaved={onSaved} />}
    </div>
  );
}

function PageEditor({ page, onSaved }: { page: SitePage; onSaved: () => void }) {
  const [p, setP] = React.useState(page);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(page);

  async function save() {
    if (p.isPublished && !p.body.trim()) { toast.error("Une page publiée ne peut pas être vide."); return; }
    setBusy(true);
    try { await savePage(p); toast.success(p.isPublished ? "Page publiée sur le site" : "Brouillon enregistré"); onSaved(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Rédaction" id="pg-edit" action={<Button size="sm" variant="ghost" className="xl:hidden" onClick={() => setPreview((v) => !v)}><Eye aria-hidden />{preview ? "Éditer" : "Aperçu"}</Button>}>
        <div className={cn("grid gap-3 p-4", preview && "hidden xl:grid")}>
          <label className="grid gap-1.5 text-sm font-semibold">Titre<input value={p.title} maxLength={120} onChange={(e) => setP({ ...p, title: e.target.value })} className={dateInputClass} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Contenu
            <textarea value={p.body} rows={18} onChange={(e) => setP({ ...p, body: e.target.value })} className={cn(textareaClass, "font-mono text-[13px] leading-relaxed")}
              placeholder={"## 1. Objet\nNDOA Wedding est une plateforme…\n\n- un point\n- un autre point\n\n**gras**, *italique*, [lien](https://…), [à compléter]"} />
          </label>
          <p className="text-[12px] text-muted">Mise en forme : <code>## Titre</code>, <code>- liste</code>, <code>**gras**</code>, <code>*italique*</code>, <code>[texte](https://…)</code>, <code>[à compléter]</code> surligné.</p>
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={p.isPublished} onChange={(e) => setP({ ...p, isPublished: e.target.checked })} />
            Publiée sur le site (remplace le texte par défaut)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!dirty} loading={busy} onClick={save}><Save aria-hidden />Enregistrer</Button>
            <a href={`${PUBLIC_SITE_URL}${PAGE_PATH[p.slug] ?? "/"}`} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-gold-ink hover:underline">Voir la page publique</a>
            {page.updatedAt && <span className="text-[12px] text-muted">Modifiée le {fmtDate(page.updatedAt, true)}</span>}
          </div>
          {!page.isPublished && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-muted">Non publiée : le site affiche le texte par défaut (avec ses éléments [à compléter]).</p>}
        </div>
      </Panel>
      <Panel title="Aperçu" id="pg-preview" className={cn(!preview && "hidden xl:block")}>
        <article className="prose-legal grid gap-3 p-5 text-[14.5px] leading-relaxed [&_h2]:mt-3 [&_h2]:font-display [&_h2]:text-xl [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-gold-ink [&_a]:underline [&_.todo]:rounded [&_.todo]:bg-gold/20 [&_.todo]:px-1">
          <h1 className="font-display text-3xl">{p.title}</h1>
          {p.body.trim() ? <Markdown source={p.body} /> : <p className="text-muted">Le contenu apparaîtra ici.</p>}
        </article>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Faqs({ faqs, onChanged, setFaqs }: { faqs: Faq[]; onChanged: () => void; setFaqs: (f: Faq[]) => void }) {
  const [audience, setAudience] = React.useState<Faq["audience"]>("couples");
  const [edit, setEdit] = React.useState<Faq | "new" | null>(null);
  const [del, setDel] = React.useState<Faq | null>(null);
  const list = faqs.filter((f) => f.audience === audience);
  return (
    <Panel title={<Segmented label="Public" layoutId="faq-aud" value={audience} onChange={setAudience} options={[{ value: "couples", label: "Couples" }, { value: "prestataires", label: "Prestataires" }]} />}
      action={<Button size="sm" onClick={() => setEdit("new")}><Plus aria-hidden />Ajouter</Button>}>
      {!list.length ? (
        <EmptyState className="m-3" icon={<HelpCircle />} title="Aucune question">{audience === "couples" ? "Sans FAQ publiée, la page Contact affiche les questions par défaut." : "Ajoutez les questions fréquentes des prestataires."}</EmptyState>
      ) : (
        <SortableList items={list} getId={(f) => f.id} label={(f) => f.question} className="divide-y divide-line"
          onReorder={async (next) => {
            setFaqs([...faqs.filter((f) => f.audience !== audience), ...next]);
            try { await reorderFaqs(next.map((f) => f.id)); toast.success("Ordre enregistré"); } catch (e) { toast.error((e as Error).message); onChanged(); }
          }}>
          {(f, handle, dragging) => (
            <div className={cn("flex items-start gap-3 bg-surface px-3 py-2.5", dragging && "rounded-lg shadow-2xl ring-1 ring-gold/50", !f.isPublished && "opacity-60")}>
              <DragHandle handle={handle} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{f.question}</p>
                <p className="line-clamp-2 text-[13px] text-muted">{f.answer}</p>
              </div>
              {!f.isPublished && <StatusTag tone="muted">Masquée</StatusTag>}
              <Button variant="ghost" size="icon" className="size-8" aria-label={`Modifier « ${f.question} »`} onClick={() => setEdit(f)}><Pencil aria-hidden /></Button>
              <Button variant="ghost" size="icon" className="size-8 text-danger" aria-label={`Supprimer « ${f.question} »`} onClick={() => setDel(f)}><Trash2 aria-hidden /></Button>
            </div>
          )}
        </SortableList>
      )}
      {edit && <FaqDialog faq={edit === "new" ? null : edit} audience={audience} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Supprimer cette question ?" confirmLabel="Supprimer"
        onConfirm={async () => { if (!del) return; try { await deleteFaq(del.id); toast.success("Question supprimée"); setDel(null); onChanged(); } catch (e) { toast.error((e as Error).message); } }}>
        <p>« {del?.question} »</p>
      </ConfirmDialog>
    </Panel>
  );
}

function FaqDialog({ faq, audience, onClose, onSaved }: { faq: Faq | null; audience: Faq["audience"]; onClose: () => void; onSaved: () => void }) {
  const [q, setQ] = React.useState(faq?.question ?? "");
  const [a, setA] = React.useState(faq?.answer ?? "");
  const [aud, setAud] = React.useState(faq?.audience ?? audience);
  const [pub, setPub] = React.useState(faq?.isPublished ?? true);
  const [busy, setBusy] = React.useState(false);
  const valid = q.trim().length >= 5 && a.trim().length >= 2;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={faq ? "Modifier la question" : "Nouvelle question"} className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button size="sm" disabled={!valid} loading={busy} onClick={async () => {
          setBusy(true);
          try { await saveFaq({ id: faq?.id, audience: aud, question: q.trim(), answer: a.trim(), isPublished: pub }); toast.success("Question enregistrée"); onSaved(); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>Enregistrer</Button>
      </>}>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm font-semibold">Question<input value={q} maxLength={300} onChange={(e) => setQ(e.target.value)} className={dateInputClass} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Réponse<textarea value={a} maxLength={3000} rows={5} onChange={(e) => setA(e.target.value)} className={textareaClass} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Pour
          <select value={aud} onChange={(e) => setAud(e.target.value as Faq["audience"])} className={dateInputClass}><option value="couples">Couples (page Contact)</option><option value="prestataires">Prestataires</option></select>
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--gold)]" checked={pub} onChange={(e) => setPub(e.target.checked)} />Publiée</label>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
const TEXT_FIELDS: { key: string; title: string; hint: string; fields: { k: string; label: string; placeholder: string; long?: boolean }[] }[] = [
  { key: "accueil.hero", title: "Accueil : titre principal", hint: "Vide = texte par défaut (« Les meilleurs prestataires pour votre mariage. »). Le dernier mot du titre s’affiche en doré.",
    fields: [{ k: "titre", label: "Titre", placeholder: "Les meilleurs prestataires pour votre mariage." }, { k: "sous_titre", label: "Sous-titre", placeholder: "Photographes, salles, traiteurs… Trouvez, comparez et réservez.", long: true }] },
  { key: "general.contact", title: "Coordonnées de contact", hint: "Affichées sur la page Contact. Vide = valeur de configuration du serveur, ou carte masquée.",
    fields: [{ k: "email", label: "E-mail", placeholder: "bonjour@ndoa.cd" }, { k: "whatsapp", label: "WhatsApp (avec indicatif)", placeholder: "+243 81 000 0000" }] },
];

function Texts({ settings, onSaved }: { settings: Setting[]; onSaved: () => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {TEXT_FIELDS.map((t) => {
        const s = settings.find((x) => x.key === t.key);
        return s ? <TextBlock key={t.key} def={t} setting={s} onSaved={onSaved} /> : null;
      })}
    </div>
  );
}

function TextBlock({ def, setting, onSaved }: { def: (typeof TEXT_FIELDS)[number]; setting: Setting; onSaved: () => void }) {
  const initial = (setting.value ?? {}) as Record<string, string>;
  const [v, setV] = React.useState<Record<string, string>>(initial);
  const [busy, setBusy] = React.useState(false);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const emailBad = def.key === "general.contact" && !!v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email);
  return (
    <Panel title={def.title} id={`t-${def.key}`}>
      <div className="grid gap-3 p-4">
        {def.fields.map((f) => (
          <label key={f.k} className="grid gap-1.5 text-sm font-semibold">{f.label}
            {f.long ? <textarea rows={2} value={v[f.k] ?? ""} maxLength={240} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} className={cn(textareaClass, "font-normal")} />
              : <input value={v[f.k] ?? ""} maxLength={120} placeholder={f.placeholder} onChange={(e) => setV({ ...v, [f.k]: e.target.value })} className={dateInputClass} aria-invalid={(f.k === "email" && emailBad) || undefined} />}
          </label>
        ))}
        {emailBad && <p role="alert" className="-mt-1 text-[13px] text-danger">Adresse e-mail invalide.</p>}
        <p className="text-[12px] text-muted">{def.hint}</p>
        <Button size="sm" className="justify-self-start" disabled={!dirty || emailBad} loading={busy} onClick={async () => {
          setBusy(true);
          try { await saveSetting(def.key, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))); toast.success("Texte enregistré sur le site"); onSaved(); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}><Save aria-hidden />Enregistrer</Button>
      </div>
    </Panel>
  );
}
