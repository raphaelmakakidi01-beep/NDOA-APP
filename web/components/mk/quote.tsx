"use client";

import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Package } from "@/lib/public/types";
import { fmt } from "./format";
import { Close } from "./icons";

type Vendor = { slug: string; name: string; avatar: string; city: string; packages: Package[]; options: { id: string | null; name: string; price: number; currency: string }[]; response: string };
const QuoteCtx = createContext<(plan?: number) => void>(() => {});
export const useQuote = () => useContext(QuoteCtx);

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const CITIES = ["Kinshasa", "Lubumbashi", "Goma", "Matadi", "Bukavu", "Kisangani", "Autre ville"];
const PREFS = [["whatsapp", "WhatsApp"], ["call", "Appel"], ["email", "E-mail"]] as const;
declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void } } }

function useTurnstile(active: boolean) {
  const box = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");
  const id = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !SITE_KEY || !box.current) return;
    const render = () => {
      if (!box.current || id.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, { sitekey: SITE_KEY, theme: "dark", language: "fr", callback: setToken, "expired-callback": () => setToken(""), "error-callback": () => setToken("") });
    };
    if (window.turnstile) render();
    else if (!document.getElementById("cf-turnstile")) {
      const s = Object.assign(document.createElement("script"), { id: "cf-turnstile", src: "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async: true, defer: true });
      s.onload = render;
      document.head.append(s);
    } else document.getElementById("cf-turnstile")!.addEventListener("load", render);
    return () => { if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = null; setToken(""); };
  }, [active]);
  return { box, token, needed: !!SITE_KEY, reset: () => { if (id.current) window.turnstile?.reset(id.current); setToken(""); } };
}

/** Demande de devis sans compte, en 3 étapes (date et lieu, besoins, coordonnées) */
export function QuoteProvider({ vendor, children, defaultDate }: { vendor: Vendor; children: React.ReactNode; defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<number>(() => Math.max(0, vendor.packages.findIndex((p) => p.featured)));
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ when: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { box: tsBox, token: tsToken, needed: tsNeeded, reset: tsReset } = useTurnstile(open && step === 2);
  const today = new Date().toISOString().slice(0, 10);

  const openQuote = useCallback((p?: number) => {
    opener.current = document.activeElement as HTMLElement;
    if (p !== undefined) setPlan(p);
    if (done) { setDone(null); setStep(0); form.current?.reset(); }
    setErr(""); setOpen(true);
  }, [done]);
  const close = useCallback(() => { setOpen(false); opener.current?.focus(); }, []);

  useEffect(() => {
    if (!open) return;
    document.documentElement.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && box.current) {
        const f = [...box.current.querySelectorAll<HTMLElement>("button, a, input, select, textarea, iframe")].filter((x) => x.offsetParent !== null && !(x as HTMLButtonElement).disabled);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key);
    setTimeout(() => box.current?.querySelector<HTMLElement>(".qstep.on input, .qstep.on select, .qstep.on h3[tabindex]")?.focus(), 60);
    return () => { document.removeEventListener("keydown", key); document.documentElement.style.overflow = ""; };
  }, [open, step, close]);

  const field = (name: string) => form.current?.elements.namedItem(name) as HTMLInputElement | null;
  function validate(n: number) {
    if (n === 0) {
      const d = field("date")?.value ?? "";
      if (!d || !field("city")?.value) return "Indiquez la date et la ville du mariage.";
      if (d < today) return "La date doit être dans le futur.";
    }
    if (n === 2) {
      if ((field("names")?.value.trim() ?? "").length < 2) return "Indiquez votre nom.";
      if ((field("phone")?.value.replace(/\D/g, "") ?? "").length < 9) return "Laissez un numéro de téléphone ou WhatsApp valide.";
      const mail = field("email")?.value.trim();
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return "L’adresse e-mail semble incorrecte.";
      if (tsNeeded && !tsToken) return "Merci de valider la vérification anti-spam.";
    }
    return "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (done) return close();
    const m = validate(step);
    setErr(m);
    if (m || sending) return;
    if (step < 2) return setStep(step + 1);
    const fd = new FormData(form.current!);
    const p = vendor.packages[plan];
    const opts = fd.getAll("opt").map((i) => vendor.options[Number(i)]);
    setSending(true);
    const res = await fetch("/api/devis", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: vendor.slug, names: fd.get("names"), phone: fd.get("phone"), email: fd.get("email"), pref: fd.get("pref"),
        date: fd.get("date"), city: fd.get("city"), venue: fd.get("venue"), guests: fd.get("guests"),
        packageId: p?.id ?? null, optionIds: opts.map((o) => o.id).filter(Boolean),
        message: [p ? `Formule souhaitée : ${p.name}` : "", opts.length ? `Options : ${opts.map((o) => o.name).join(", ")}` : "", String(fd.get("message") ?? "")].filter(Boolean).join("\n"),
        turnstile: tsToken, source: "profil",
      }),
    }).then((r) => r.json()).catch(() => ({ error: "L’envoi a échoué. Vérifiez votre connexion et réessayez." }));
    setSending(false);
    if (res.error) { setErr(res.error); tsReset(); return; }
    setDone({ when: new Date(`${fd.get("date")}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) });
    setStep(3);
  }

  const steps = ["Date & lieu", "Vos besoins", "Coordonnées"];
  return (
    <QuoteCtx.Provider value={openQuote}>
      {children}
      <div className={`qm${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby="qmTitle" aria-hidden={!open} inert={!open} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="qm-box" ref={box}>
          <div className="qm-head">
            <Image src={vendor.avatar} alt="" width={44} height={44} />
            <div className="t"><small>Demande de devis</small><strong id="qmTitle">{vendor.name}</strong></div>
            <button className="qm-close" aria-label="Fermer la demande de devis" onClick={close}><Close /></button>
          </div>
          {step < 3 && (
            <ol className="qm-steps" aria-label="Étapes">
              {steps.map((s, i) => <li key={s} className={i < step ? "done" : i === step ? "cur" : ""} aria-current={i === step ? "step" : undefined}><i />{s}</li>)}
            </ol>
          )}
          <form ref={form} noValidate onSubmit={submit} onInput={() => setErr("")}>
            <div className="qm-body">
              <section className={`qstep${step === 0 ? " on" : ""}`}>
                <h3>Le <em>grand jour</em></h3>
                <p>Quelques informations pour vérifier la disponibilité.</p>
                <div className="qgrid two">
                  <label className="qf"><span>Date du mariage</span><input type="date" name="date" min={today} defaultValue={defaultDate} required /></label>
                  <label className="qf"><span>Ville</span>
                    <select name="city" defaultValue={CITIES.includes(vendor.city) ? vendor.city : ""} required>
                      <option value="">Choisir…</option>
                      {[...new Set([vendor.city, ...CITIES])].map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="qf"><span>Lieu / salle (si connu)</span><input type="text" name="venue" maxLength={80} placeholder="Ex. : salle, quartier…" /></label>
                  <label className="qf"><span>Nombre d’invités</span><input type="number" name="guests" min={1} max={5000} inputMode="numeric" placeholder="250" /></label>
                </div>
              </section>
              <section className={`qstep${step === 1 ? " on" : ""}`}>
                <h3>Vos <em>envies</em></h3>
                <p>Choisissez une formule de départ : tout reste ajustable avec le prestataire.</p>
                {vendor.packages.length > 0 && (
                  <div className="choice">
                    {vendor.packages.map((p, i) => (
                      <label key={p.name + i}><input type="radio" name="plan" checked={plan === i} onChange={() => setPlan(i)} />
                        <span className="ct">{p.name}<small>{p.description}</small></span><span className="cp">dès {fmt(p.price)} {p.currency}</span></label>
                    ))}
                    <label><input type="radio" name="plan" checked={plan === -1} onChange={() => setPlan(-1)} /><span className="ct">Je ne sais pas encore<small>Le prestataire vous conseillera</small></span></label>
                  </div>
                )}
                {vendor.options.length > 0 && <>
                  <div className="qlabel">Options</div>
                  <div className="chips-in">{vendor.options.map((o, i) => <label key={o.name + i}><input type="checkbox" name="opt" value={i} /><span>{o.name} · +{fmt(o.price)} {o.currency}</span></label>)}</div>
                </>}
                <div className="qlabel">Votre message</div>
                <label className="qf"><span className="sr-only">Message</span><textarea name="message" maxLength={2500} placeholder="Parlez-nous de votre mariage : ambiance, cérémonies prévues, budget…" /></label>
              </section>
              <section className={`qstep${step === 2 ? " on" : ""}`}>
                <h3>Vos <em>coordonnées</em></h3>
                <p>Le prestataire vous répond directement. Aucun compte à créer, aucun frais, aucun engagement.</p>
                <div className="qgrid two">
                  <label className="qf"><span>Votre nom</span><input type="text" name="names" maxLength={80} placeholder="Grâce & Patrick" autoComplete="name" required /></label>
                  <label className="qf"><span>Téléphone / WhatsApp</span><input type="tel" name="phone" maxLength={30} placeholder="+243 …" autoComplete="tel" required /></label>
                </div>
                <label className="qf" style={{ marginTop: 10 }}><span>E-mail (facultatif)</span><input type="email" name="email" maxLength={120} placeholder="vous@email.com" autoComplete="email" /></label>
                <div className="qlabel">Être recontacté par</div>
                <div className="chips-in">{PREFS.map(([v, l], i) => <label key={v}><input type="radio" name="pref" value={v} defaultChecked={i === 0} /><span>{l}</span></label>)}</div>
                {tsNeeded && <div ref={tsBox} style={{ marginTop: 14, minHeight: 65 }} />}
              </section>
              <section className={`qstep${step === 3 ? " on" : ""}`}>
                <div className="done-box">
                  <div className="seal" aria-hidden="true">
                    <svg viewBox="0 0 120 120"><defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9C7A3C" /><stop offset=".5" stopColor="#F1D9A6" /><stop offset="1" stopColor="#C4975A" /></linearGradient></defs>
                      <circle className="ring" cx="60" cy="60" r="54" pathLength={1} transform="rotate(-90 60 60)" /><path className="check" pathLength={1} d="M40 61l14 14 27-29" /></svg>
                  </div>
                  <h3 className="display" tabIndex={-1}>Demande <em>envoyée.</em></h3>
                  <p>{vendor.name} a bien reçu votre demande{vendor.response ? ` et répond en général en ${vendor.response}` : ""}{done ? ` pour le ${done.when}` : ""}.</p>
                </div>
              </section>
            </div>
            <p className="qerr" role="alert">{err}</p>
            <div className="qm-foot">
              <button type="button" className="btn btn-ghost" style={{ visibility: step === 0 || step === 3 ? "hidden" : "visible" }} onClick={() => { setErr(""); setStep(Math.max(0, step - 1)); }}>Retour</button>
              <button type="submit" className="btn btn-gold" disabled={sending} aria-busy={sending}>
                {step === 3 ? "Fermer" : step === 2 ? (sending ? "Envoi…" : <>Envoyer la demande <span className="arrow">→</span></>) : <>Continuer <span className="arrow">→</span></>}
              </button>
            </div>
            {step < 3 && <p className="qm-note">Gratuit et sans engagement · Vos coordonnées ne sont transmises qu’à ce prestataire.</p>}
          </form>
        </div>
      </div>
    </QuoteCtx.Provider>
  );
}

/** Bouton qui ouvre la demande de devis (n’importe où dans la page profil) */
export function QuoteButton({ plan, className = "btn btn-gold", children }: { plan?: number; className?: string; children: React.ReactNode }) {
  const open = useQuote();
  return <button type="button" className={className} onClick={() => open(plan)}>{children}</button>;
}
