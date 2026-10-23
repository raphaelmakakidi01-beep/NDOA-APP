import { Markdown } from "@/lib/markdown";

/** Mise en page des documents légaux (design des pages d'origine : .pg, .legal) */
export function Legal({ title, accent, children, intro, notice = true }: { title: string; accent: string; children: React.ReactNode; intro?: React.ReactNode; notice?: boolean }) {
  return (
    <section className="pg">
      <div className="container">
        <div className="pg-head">
          <p className="eyebrow">Informations légales</p>
          <h1 className="display">{title} <em className="gold-text">{accent}</em></h1>
          {intro}
        </div>
        <div className="legal">
          {notice && <p className="notice"><strong>Document à faire valider par un juriste avant la mise en ligne.</strong> Les éléments entre crochets sont à compléter avec les informations officielles de la société.</p>}
          {children}
        </div>
      </div>
    </section>
  );
}

export const Todo = ({ children }: { children: React.ReactNode }) => <span className="todo">[{children}]</span>;

/** Version publiée depuis l'admin (Pages et contenus) : remplace le texte par défaut */
export function EditedLegal({ page }: { page: { title: string; body: string; updatedAt?: string } }) {
  const words = page.title.trim().split(/\s+/);
  const accent = words.length > 1 ? words.pop()! : "";
  return (
    <Legal title={words.join(" ")} accent={accent} notice={false}
      intro={page.updatedAt ? <p>Mis à jour le {new Date(page.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</p> : undefined}>
      <Markdown source={page.body} />
    </Legal>
  );
}
