import * as React from "react";

/**
 * Markdown simple et sûr pour les pages éditées dans l'admin (aucun HTML brut injecté) :
 * titres « ## » et « ### », paragraphes, listes « - » et « 1. », **gras**, *italique*,
 * liens [texte](https://…, mailto:…, /chemin), et [à compléter] mis en évidence.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)|\[([^\]]+)\]/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[1]) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k}>{m[2]}</em>);
    else if (m[3]) {
      const href = m[4];
      const safe = /^(https?:\/\/|mailto:|tel:|\/(?!\/))/.test(href);
      out.push(safe ? <a key={k} href={href} {...(/^https?:/.test(href) ? { target: "_blank", rel: "noopener" } : {})}>{m[3]}</a> : m[3]);
    } else if (m[5]) out.push(<span key={k} className="todo">[{m[5]}]</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) { blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>); para = []; }
    if (list) {
      const items = list.items.map((it, j) => <li key={j}>{inline(it, `l${blocks.length}-${j}`)}</li>);
      blocks.push(list.ordered ? <ol key={`o${blocks.length}`}>{items}</ol> : <ul key={`u${blocks.length}`}>{items}</ul>);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{2,3})\s+(.+)$/.exec(line);
    const li = /^\s*(?:[-*]|(\d+)\.)\s+(.+)$/.exec(line);
    if (!line.trim()) { flush(); continue; }
    if (h) { flush(); blocks.push(h[1] === "##" ? <h2 key={`h${blocks.length}`}>{inline(h[2], `h${blocks.length}`)}</h2> : <h3 key={`h${blocks.length}`}>{inline(h[2], `h${blocks.length}`)}</h3>); continue; }
    if (li) {
      if (para.length) flush();
      const ordered = !!li[1];
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(li[2]);
      continue;
    }
    if (list) flush();
    para.push(line.trim());
  }
  flush();
  return <>{blocks}</>;
}
