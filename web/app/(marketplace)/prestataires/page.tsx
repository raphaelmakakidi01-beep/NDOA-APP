import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { directoryUrl, fmt } from "@/components/mk/format";
import { Search } from "@/components/mk/icons";
import { VendorCard } from "@/components/mk/vendor-card";
import { BUDGETS, getHome, searchDirectory, SORTS } from "@/lib/public/data";
import type { DirectoryQuery } from "@/lib/public/types";

export const metadata: Metadata = {
  title: "Tous les prestataires de mariage",
  description: "L’annuaire NDOA Wedding : photographes, vidéastes, salles, traiteurs, DJ, décorateurs… Filtrez par ville, budget et note, puis demandez vos devis gratuitement.",
  alternates: { canonical: "/prestataires" },
};

const NOTES = [["4.5", "4,5 ★ et plus"], ["4", "4 ★ et plus"]];
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 80) : undefined);

function JoinNdoa({ empty }: { empty?: boolean }) {
  return (
    <aside className="join" aria-labelledby="join-title">
      <h2 id="join-title">{empty ? "Vous ne trouvez pas ? " : ""}Vous êtes <em className="gold-text">prestataire</em> ?</h2>
      <p>Rejoignez NDOA : une vitrine qui ressemble à un portfolio et des demandes de devis directement dans votre espace. Gratuit pour commencer.</p>
      <Link className="btn btn-gold" href="/pro">Rejoindre NDOA <span className="arrow">→</span></Link>
    </aside>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/prestataires">["searchParams"] }) {
  const sp = await searchParams;
  const q: DirectoryQuery = {
    q: str(sp.q), categorie: str(sp.categorie), ville: str(sp.ville), budget: str(sp.budget), note: str(sp.note),
    date: str(sp.date), tri: str(sp.tri), page: Number(str(sp.page)) || 1,
  };
  const [home, res] = await Promise.all([getHome(), searchDirectory(q)]);
  const cityList = home.cities.length ? home.cities : [...new Set(home.vendors.map((v) => v.city))].sort();
  const cat = home.categories.find((c) => c.slug === q.categorie);
  const filtered = !!(q.q || q.categorie || q.ville || q.budget || q.note || q.date);
  const link = (page: number) => directoryUrl({ ...q, page: page > 1 ? String(page) : undefined } as Record<string, string | undefined>);

  return (
    <>
      <form className="dir-filters" action="/prestataires" method="get" role="search" aria-label="Filtrer les prestataires">
        <label className="q">Recherche<input name="q" type="search" defaultValue={q.q} placeholder="Nom, style, quartier…" /></label>
        <label>Catégorie
          <select name="categorie" defaultValue={q.categorie ?? ""}>
            <option value="">Toutes</option>
            {home.categories.map((c) => <option key={c.slug} value={c.slug}>{c.plural}</option>)}
          </select>
        </label>
        <label>Ville
          <select name="ville" defaultValue={q.ville ?? ""}>
            <option value="">Toutes</option>
            {cityList.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Budget
          <select name="budget" defaultValue={q.budget ?? ""}>
            <option value="">Tous</option>
            {BUDGETS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </label>
        <label>Note
          <select name="note" defaultValue={q.note ?? ""}>
            <option value="">Toutes</option>
            {NOTES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>Trier
          <select name="tri" defaultValue={q.tri ?? "pertinence"}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label>Date libre<input name="date" type="date" defaultValue={q.date} /></label>
        <button className="btn btn-gold" type="submit"><Search />Filtrer</button>
      </form>

      <div className="dir-meta">
        <span aria-live="polite">
          <b>{fmt(res.total)}</b> prestataire{res.total > 1 ? "s" : ""}{cat ? ` · ${cat.plural}` : ""}{q.ville ? ` · ${q.ville}` : ""}
          {q.date && ` · libres le ${new Date(`${q.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`}
        </span>
        {filtered && <Link href="/prestataires">Réinitialiser les filtres</Link>}
      </div>

      {res.items.length ? (
        <div className="feed">{res.items.map((v) => <VendorCard key={v.slug} v={v} />)}</div>
      ) : (
        <div className="empty"><strong>Aucun talent pour cette recherche… pour l’instant.</strong>Élargissez vos filtres : d’autres prestataires vous attendent.</div>
      )}

      {res.pages > 1 && (
        <nav className="pager" aria-label="Pages de résultats">
          {res.page > 1 && <Link href={link(res.page - 1)} rel="prev">← Précédent</Link>}
          {Array.from({ length: res.pages }, (_, i) => i + 1).filter((p) => p === 1 || p === res.pages || Math.abs(p - res.page) <= 1).map((p, i, arr) => (
            <span key={p} className="contents">
              {i > 0 && p - arr[i - 1] > 1 && <span aria-hidden="true">…</span>}
              <Link href={link(p)} aria-current={p === res.page ? "page" : undefined} aria-label={`Page ${p}`}>{p}</Link>
            </span>
          ))}
          {res.page < res.pages && <Link href={link(res.page + 1)} rel="next">Suivant →</Link>}
        </nav>
      )}

      <JoinNdoa empty={!res.items.length} />
    </>
  );
}

export default function Annuaire({ searchParams }: PageProps<"/prestataires">) {
  return (
    <section className="section" aria-labelledby="dir-title" style={{ paddingTop: 0 }}>
      <div className="container dir-head">
        <h1 className="display" id="dir-title">Tous les <em className="gold-text">prestataires</em></h1>
        <p>Comparez les vitrines, les tarifs et les avis, puis demandez vos devis gratuitement, sans créer de compte.</p>
        <Suspense fallback={<div className="dir-filters" aria-busy="true" style={{ minHeight: 160 }} />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </section>
  );
}
