"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { WhatsApp } from "./icons";

type Message = { role: "user" | "assistant"; content: string; handoff?: { url?: string }; error?: boolean };

const SUGGESTIONS = ["Je cherche un photographe à Kinshasa", "Comment demander un devis ?", "Je veux parler à un conseiller"];
const SITE_PATH = /(\/(?:prestataires(?:\/[a-z0-9-]+)?|inspiration|budget-mariage|contact|pro|inscription|mon-compte|confidentialite|cgu))(?![\w/-])/g;

/** Seuls les liens internes connus deviennent cliquables : le texte vient du modèle */
function Rich({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  return text.split(SITE_PATH).map((part, i) => (i % 2 ? <Link key={i} href={part} onClick={onNavigate}>{part}</Link> : <Fragment key={i}>{part}</Fragment>));
}

/** Assistant du site : répond aux questions et propose un conseiller WhatsApp quand c'est pertinent */
export function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const hello = useRef<HTMLSpanElement>(null);
  const abort = useRef<AbortController | null>(null);

  // La bulle d'accueil ne s'affiche qu'une fois par visite
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ndoa-assistant-vu")) return;
      sessionStorage.setItem("ndoa-assistant-vu", "1");
    } catch { return; }
    hello.current?.classList.add("hello");
  }, []);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      setTimeout(() => opener.current?.focus()); // le bouton revient à la fermeture
    };
  }, [open]);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => () => abort.current?.abort(), []);

  const update = (fn: (m: Message) => Message) => setMessages((list) => [...list.slice(0, -1), fn(list[list.length - 1])]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    // L'historique renvoyé ne garde que les 18 derniers messages valides, en commençant par une question
    const clean = messages.filter((m) => !m.error && m.content.trim());
    const recent = clean.slice(-18);
    const start = recent.findIndex((m) => m.role === "user");
    const history = (start < 0 ? [] : recent.slice(start)).map(({ role, content }) => ({ role, content }));
    setMessages((list) => [...list, { role: "user", content: text }, { role: "assistant", content: "" }]);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ messages: [...history, { role: "user", content: text }] }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? "L’assistant est momentanément indisponible.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const e = JSON.parse(line) as { t: "text" | "error"; v: string } | { t: "handoff"; url?: string };
          if (e.t === "text") update((m) => ({ ...m, content: m.content + e.v }));
          else if (e.t === "handoff") update((m) => ({ ...m, handoff: { url: e.url } }));
          else update((m) => ({ ...m, content: m.content ? `${m.content}\n${e.v}` : e.v, error: !m.content }));
        }
      }
      update((m) => (m.content || m.handoff ? m : { ...m, content: "Je n’ai pas de réponse pour le moment. Vous pouvez nous écrire depuis la page /contact.", error: true }));
    } catch (err) {
      if (ctrl.signal.aborted) return;
      update((m) => ({ ...m, content: err instanceof Error ? `${err.message} Vous pouvez aussi passer par la page /contact.` : "Une erreur est survenue.", error: true }));
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  const close = () => setOpen(false);

  return (
    <>
      {!open && (
        <button ref={opener} type="button" className="wa-fab ai-fab" aria-label="Ouvrir l’assistant NDOA" aria-expanded={false} onClick={() => setOpen(true)}>
          <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H4l1.8-3.2A8 8 0 1 1 21 12Z" /><path d="M9 11.5h.01M13 11.5h.01M17 11.5h.01" /></svg>
          <span ref={hello} className="wa-fab-msg" aria-hidden="true"><b>Une question ?</b>Notre assistant vous répond</span>
        </button>
      )}
      {open && (
        <section className="ai-panel" role="dialog" aria-modal="false" aria-labelledby="ai-title">
          <header className="ai-head">
            <div>
              <h2 id="ai-title">Assistant NDOA</h2>
              <p>Assistant IA, il peut se tromper</p>
            </div>
            <button type="button" className="ai-close" aria-label="Fermer l’assistant" onClick={close}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>
          <div className="ai-log" ref={log} aria-live="polite" aria-busy={busy}>
            {!messages.length && (
              <div className="ai-intro">
                <p>Bonjour ! Je peux vous aider à trouver un prestataire ou à comprendre le site. Si besoin, je vous mets en relation avec un conseiller.</p>
                <div className="ai-suggest">
                  {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}${m.error ? " error" : ""}`}>
                {m.content && <p><Rich text={m.content} onNavigate={() => setOpen(false)} /></p>}
                {m.role === "assistant" && !m.content && !m.handoff && busy && i === messages.length - 1 && <span className="ai-dots" role="status" aria-label="L’assistant écrit"><i /><i /><i /></span>}
                {m.handoff && (m.handoff.url
                  ? <a className="btn btn-gold ai-human" href={m.handoff.url} target="_blank" rel="noopener noreferrer"><WhatsApp />Continuer avec un conseiller</a>
                  : <Link className="btn btn-gold ai-human" href="/contact" onClick={() => setOpen(false)}>Contacter l’équipe</Link>)}
              </div>
            ))}
          </div>
          <form className="ai-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <textarea ref={field} rows={1} maxLength={800} value={input} placeholder="Écrivez votre question…" aria-label="Votre question"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
            <button type="submit" aria-label="Envoyer" disabled={busy || !input.trim()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
            </button>
          </form>
          <p className="ai-note">Évitez d’écrire des données sensibles. <Link href="/confidentialite" onClick={() => setOpen(false)}>Confidentialité</Link></p>
        </section>
      )}
    </>
  );
}
