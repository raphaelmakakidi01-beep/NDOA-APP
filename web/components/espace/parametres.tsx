"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, Eye, EyeOff, KeyRound, Laptop, LogOut, Mail, PauseCircle, RotateCw, Smartphone, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { del, keys } from "idb-keyval";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardHeader, Skeleton, StatusTag, timeAgo } from "@/components/ui/bits";
import { PhoneInput } from "@/components/auth/phone-input";
import { useEspace } from "@/lib/espace/store";
import { useAccount } from "@/lib/espace/business5";
import { remote5 } from "@/lib/espace/remote-step5";
import { changePassword, confirmTwoFactor, disableTwoFactor, signOut, signOutOthers, startTwoFactor, updateAccount } from "@/lib/auth";
import { passwordRules, phoneValid, toE164 } from "@/lib/validation";
import { getSupabase } from "@/lib/supabase/client";
import { NOTIF_CHANNELS, NOTIF_TYPES, OFFERS, PLANS, ROLES, type Locale, type MemberRole, type NotifChannel, type NotifType } from "@/lib/espace/types";
import { cn } from "@/lib/utils";

import { SECTIONS, type SectionId } from "./parametres-sections";

/** Interrupteur accessible (role="switch") */
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:opacity-40",
        checked ? "border-gold bg-gold" : "border-line-strong bg-surface-2")}>
      <span className={cn("absolute size-5 rounded-full shadow transition-transform", checked ? "translate-x-[22px] bg-on-gold" : "translate-x-[3px] bg-muted")} />
    </button>
  );
}

/* ---------------------------------------------------------
   Compte
   --------------------------------------------------------- */
function splitPhone(p?: string) {
  if (!p) return { country: "+243", local: "" };
  const m = /^(\+\d{3})(\d+)$/.exec(p.replace(/\s/g, ""));
  return m ? { country: m[1], local: m[2] } : { country: "+243", local: p };
}

function Compte() {
  const { user, setUser } = useEspace();
  const init = splitPhone(user.phone);
  const [f, setF] = useState({ fullName: user.fullName, email: user.email ?? "", country: init.country, phone: init.local });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const phoneE164 = f.phone ? toE164(f.country, f.phone) : "";
  const dirty = f.fullName !== user.fullName || f.email !== (user.email ?? "") || phoneE164 !== (user.phone ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (f.fullName.trim().length < 2) n.fullName = "Indiquez votre nom.";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) n.email = "Adresse e-mail invalide.";
    if (f.phone && !phoneValid(f.country, f.phone)) n.phone = "Numéro invalide pour cet indicatif.";
    if (!f.email && !f.phone) n.email = "Gardez au moins un e-mail ou un téléphone pour vous connecter.";
    setErr(n);
    if (Object.keys(n).length) return;
    setBusy(true);
    const r = await updateAccount({ fullName: f.fullName.trim(), email: f.email.trim() || undefined, phone: phoneE164 || undefined });
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    setUser(r.user);
    toast.success("Compte mis à jour", r.emailPending ? { description: `Confirmez votre nouvelle adresse grâce au lien envoyé à ${f.email}.` } : undefined);
  };

  return (
    <Card>
      <CardHeader title="Compte" sub="Vos informations personnelles de connexion. Les coordonnées affichées aux couples se règlent dans Ma vitrine." />
      <form onSubmit={save} noValidate className="grid max-w-xl gap-5">
        <Field label="Nom complet" error={err.fullName}>{(a) => <Input id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} value={f.fullName} maxLength={80} autoComplete="name" onChange={(e) => setF({ ...f, fullName: e.target.value })} />}</Field>
        <Field label="E-mail" error={err.email} hint="Un changement d’adresse doit être confirmé depuis la nouvelle boîte.">{(a) => <Input id={a.id} type="email" aria-invalid={a.invalid} aria-describedby={a.describedBy} value={f.email} autoComplete="email" onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label="Téléphone" error={err.phone} optional>
          {(a) => <PhoneInput id={a.id} describedBy={a.describedBy} invalid={a.invalid} country={f.country} onCountry={(c) => setF({ ...f, country: c })} value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />}
        </Field>
        <div><Button type="submit" loading={busy} disabled={!dirty}>Enregistrer</Button></div>
      </form>
    </Card>
  );
}

/* ---------------------------------------------------------
   Sécurité
   --------------------------------------------------------- */
function Securite() {
  const { user, data } = useEspace();
  const acc = useAccount();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [conf, setConf] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tfa, setTfa] = useState<{ step: "phone" | "code"; phone: string; country: string; code: string; ids?: { factorId: string; challengeId: string }; error?: string; busy?: boolean } | null>(null);
  const [now] = useState(() => Date.now());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (!cur) n.cur = "Saisissez votre mot de passe actuel.";
    const failed = passwordRules.filter((r) => !r.test(next));
    if (failed.length) n.next = `Encore : ${failed.map((r) => r.label.toLowerCase()).join(", ")}.`;
    else if (next === cur) n.next = "Choisissez un mot de passe différent de l’actuel.";
    if (conf !== next) n.conf = "Les deux mots de passe ne correspondent pas.";
    setErr(n);
    if (Object.keys(n).length) return;
    setBusy(true);
    const r = await changePassword(user.email ?? user.phone ?? "", cur, next);
    setBusy(false);
    if (!r.ok) { setErr({ cur: r.error }); return; }
    setCur(""); setNext(""); setConf("");
    toast.success("Mot de passe modifié", { description: "Utilisez-le dès votre prochaine connexion." });
  };

  const sendCode = async () => {
    if (!tfa) return;
    if (!phoneValid(tfa.country, tfa.phone)) { setTfa({ ...tfa, error: "Numéro invalide." }); return; }
    setTfa({ ...tfa, busy: true, error: undefined });
    const r = await startTwoFactor(toE164(tfa.country, tfa.phone));
    if (!r.ok) { setTfa({ ...tfa, busy: false, error: r.error }); return; }
    setTfa({ ...tfa, step: "code", busy: false, ids: { factorId: r.factorId, challengeId: r.challengeId } });
  };
  const confirmCode = async () => {
    if (!tfa?.ids) return;
    setTfa({ ...tfa, busy: true, error: undefined });
    const r = await confirmTwoFactor(tfa.ids.factorId, tfa.ids.challengeId, tfa.code);
    if (!r.ok) { setTfa({ ...tfa, busy: false, error: r.error }); return; }
    acc.saveSettings({ twoFactor: true });
    setTfa(null);
    toast.success("Double authentification activée", { description: "Un code vous sera demandé à chaque nouvelle connexion." });
  };

  const others = data.settings.sessions.filter((s) => !s.current);
  const rules = passwordRules.map((r) => ({ ...r, ok: r.test(next) }));

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader title="Mot de passe" />
        <form onSubmit={submit} noValidate className="grid max-w-xl gap-5">
          <Field label="Mot de passe actuel" error={err.cur}>{(a) => <Input id={a.id} type={show ? "text" : "password"} autoComplete="current-password" aria-invalid={a.invalid} aria-describedby={a.describedBy} value={cur} onChange={(e) => setCur(e.target.value)} />}</Field>
          <Field label="Nouveau mot de passe" error={err.next}>
            {(a) => (
              <div className="relative">
                <Input id={a.id} type={show ? "text" : "password"} autoComplete="new-password" aria-invalid={a.invalid} aria-describedby={`${a.describedBy ?? ""} pw-rules`.trim()} value={next} onChange={(e) => setNext(e.target.value)} className="pr-12" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-text" aria-label={show ? "Masquer les mots de passe" : "Afficher les mots de passe"} aria-pressed={show}>{show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}</button>
              </div>
            )}
          </Field>
          <ul id="pw-rules" className="-mt-3 grid grid-cols-2 gap-1.5 text-[13px]">
            {rules.map((r) => <li key={r.id} className={cn("flex items-center gap-1.5", r.ok ? "text-success" : "text-muted")}><Check className={cn("size-3.5", !r.ok && "opacity-30")} aria-hidden />{r.label}<span className="sr-only">{r.ok ? " : respecté" : " : manquant"}</span></li>)}
          </ul>
          <Field label="Confirmer le nouveau mot de passe" error={err.conf}>{(a) => <Input id={a.id} type={show ? "text" : "password"} autoComplete="new-password" aria-invalid={a.invalid} aria-describedby={a.describedBy} value={conf} onChange={(e) => setConf(e.target.value)} />}</Field>
          <div><Button type="submit" loading={busy}><KeyRound aria-hidden />Changer le mot de passe</Button></div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold-ink"><Smartphone className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 font-display text-xl">Double authentification {data.settings.twoFactor ? <StatusTag tone="success">Activée</StatusTag> : <StatusTag tone="muted">Désactivée</StatusTag>}</h2>
            <p className="mt-1 text-sm text-muted">Un code par SMS en plus du mot de passe. Fortement conseillé si plusieurs personnes gèrent votre vitrine.</p>
          </div>
          {data.settings.twoFactor
            ? <Button variant="outline" size="sm" onClick={async () => { await disableTwoFactor(); acc.saveSettings({ twoFactor: false }); toast.success("Double authentification désactivée"); }}>Désactiver</Button>
            : <Button size="sm" onClick={() => { const p = splitPhone(user.phone); setTfa({ step: "phone", country: p.country, phone: p.local, code: "" }); }}>Activer</Button>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Appareils connectés" sub="Déconnectez un appareil perdu ou que vous ne reconnaissez pas."
          action={others.length > 0 && <Button size="sm" variant="outline" onClick={async () => { const r = await signOutOthers(); if (r.ok) { others.forEach((s) => acc.revokeSession(s.id)); toast.success("Autres appareils déconnectés"); } else toast.error(r.error); }}><LogOut aria-hidden />Déconnecter les autres</Button>} />
        <ul className="divide-y divide-line">
          {data.settings.sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">{/iphone|android/i.test(s.device) ? <Smartphone className="size-4" aria-hidden /> : <Laptop className="size-4" aria-hidden />}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{s.device}{s.current && <StatusTag tone="success">Cet appareil</StatusTag>}</p>
                <p className="text-[13px] text-muted">{[s.place, s.current ? "actif maintenant" : `actif ${timeAgo(s.lastActiveAt)}`].filter(Boolean).join(" · ")}{!s.current && now - +new Date(s.lastActiveAt) > 5 * 86400_000 ? " · inactif depuis plusieurs jours" : ""}</p>
              </div>
              {!s.current && <Button size="sm" variant="ghost" onClick={() => { acc.revokeSession(s.id); toast.success(`${s.device} déconnecté`); }}>Déconnecter</Button>}
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={!!tfa} onOpenChange={(o) => !o && setTfa(null)} title="Activer la double authentification"
        description={tfa?.step === "code" ? `Saisissez le code reçu par SMS au ${tfa.country} ${tfa.phone}.` : "Nous enverrons un code de vérification à ce numéro."}
        footer={<><Button variant="ghost" onClick={() => setTfa(null)}>Annuler</Button>{tfa?.step === "code" ? <Button onClick={confirmCode} loading={tfa.busy} disabled={(tfa.code ?? "").length !== 6}>Vérifier</Button> : <Button onClick={sendCode} loading={tfa?.busy}>Envoyer le code</Button>}</>}>
        {tfa && (tfa.step === "phone" ? (
          <Field label="Téléphone" error={tfa.error}>{(a) => <PhoneInput id={a.id} describedBy={a.describedBy} invalid={a.invalid} country={tfa.country} onCountry={(c) => setTfa({ ...tfa, country: c })} value={tfa.phone} onChange={(v) => setTfa({ ...tfa, phone: v, error: undefined })} />}</Field>
        ) : (
          <Field label="Code à 6 chiffres" error={tfa.error} hint={getSupabase() ? undefined : "Mode démo : utilisez 123456."}>
            {(a) => <Input id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={tfa.code} onChange={(e) => setTfa({ ...tfa, code: e.target.value.replace(/\D/g, ""), error: undefined })} className="text-center text-2xl tracking-[0.5em]" autoFocus />}
          </Field>
        ))}
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------
   Notifications
   --------------------------------------------------------- */
function Notifications() {
  const { data, user } = useEspace();
  const acc = useAccount();
  const channels = Object.keys(NOTIF_CHANNELS) as NotifChannel[];
  const needsPhone = !user.phone;
  return (
    <Card>
      <CardHeader title="Notifications" sub="Choisissez comment être prévenu. Les changements sont enregistrés immédiatement." />
      {needsPhone && <p className="mb-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm">Ajoutez un numéro dans <Link href="/espace/parametres/compte" className="font-semibold text-gold-ink underline-offset-4 hover:underline">Compte</Link> pour recevoir les alertes par SMS et WhatsApp.</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="py-2 text-left font-semibold">Événement</th>
              {channels.map((c) => <th key={c} className="w-24 py-2 text-center font-semibold">{NOTIF_CHANNELS[c]}</th>)}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(NOTIF_TYPES) as NotifType[]).map((t) => (
              <tr key={t} className="border-b border-line/70 last:border-0">
                <th scope="row" className="py-3.5 pr-4 text-left font-normal"><span className="block font-semibold">{NOTIF_TYPES[t].label}</span><span className="text-[13px] text-muted">{NOTIF_TYPES[t].hint}</span></th>
                {channels.map((c) => (
                  <td key={c} className="py-3.5 text-center">
                    <span className="inline-flex"><Switch checked={data.notifPrefs[t][c]} disabled={(c === "sms" || c === "whatsapp") && needsPhone} label={`${NOTIF_TYPES[t].label} par ${NOTIF_CHANNELS[c]}`}
                      onChange={(v) => { acc.setPref(t, c, v); toast.success(`${NOTIF_TYPES[t].label} · ${NOTIF_CHANNELS[c]} ${v ? "activé" : "désactivé"}`, { id: "pref" }); }} /></span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[13px] text-muted">Les SMS et messages WhatsApp ne sont envoyés qu’entre 7 h et 21 h, sauf pour une nouvelle demande.</p>
    </Card>
  );
}

/* ---------------------------------------------------------
   Équipe
   --------------------------------------------------------- */
function Equipe() {
  const { data, user } = useEspace();
  const acc = useAccount();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [revoke, setRevoke] = useState<string | null>(null);
  const full = acc.activeMembers >= acc.seats;
  const target = data.members.find((m) => m.id === revoke);

  const invite = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr("Adresse e-mail invalide."); return; }
    setBusy(true);
    const r = await acc.invite(email, role);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setOpen(false); setEmail(""); setRole("editor");
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <CardHeader title="Équipe" sub={`Places utilisées : ${acc.activeMembers} sur ${acc.seats} · offre ${PLANS[data.plan].name}`}
          action={<Button size="sm" onClick={() => { setErr(""); setOpen(true); }} disabled={full}><UserPlus aria-hidden />Inviter</Button>} />
        {full && <p className="mb-4 rounded-2xl border border-gold/40 bg-gold/8 px-4 py-3 text-sm">Toutes les places sont prises. {data.plan !== "prestige" && <Link href="/espace/abonnement" className="font-semibold text-gold-ink underline-offset-4 hover:underline">L’offre {data.plan === "free" ? "Pro" : "Prestige"} inclut {OFFERS[data.plan === "free" ? "pro" : "prestige"].seats} places.</Link>}</p>}
        <ul className="divide-y divide-line">
          {data.members.map((m) => {
            const name = m.you ? user.fullName || "Vous" : m.name ?? m.email;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold/15 text-sm font-bold text-gold-ink" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{name}{m.you && <span className="font-normal text-muted">(vous)</span>}{m.status === "invited" && <StatusTag tone="gold">Invitation envoyée</StatusTag>}</p>
                  <p className="truncate text-[13px] text-muted">{m.you ? user.email ?? user.phone : m.email}{m.status === "invited" ? ` · ${timeAgo(m.invitedAt)}` : m.lastActiveAt && !m.you ? ` · actif ${timeAgo(m.lastActiveAt)}` : ""}</p>
                </div>
                <div className="flex w-full items-center gap-1 pl-[3.25rem] sm:w-auto sm:pl-0">
                {m.role === "owner" ? <StatusTag tone="muted">{ROLES.owner.label}</StatusTag> : (
                  <>
                    <label className="sr-only" htmlFor={`role-${m.id}`}>Rôle de {name}</label>
                    <Select id={`role-${m.id}`} value={m.role} onChange={(e) => acc.setRole(m.id, e.target.value as MemberRole)} className="h-10 w-full flex-1 text-sm sm:w-36 sm:flex-none">
                      {(["manager", "editor", "viewer"] as const).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                    </Select>
                    {m.status === "invited" && <button type="button" onClick={() => acc.resend(m.id)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Renvoyer l’invitation à ${m.email}`}><RotateCw className="size-4" aria-hidden /></button>}
                    <button type="button" onClick={() => setRevoke(m.id)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={m.status === "invited" ? `Annuler l’invitation de ${m.email}` : `Retirer ${name} de l’équipe`}><Trash2 className="size-4" aria-hidden /></button>
                  </>
                )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Rôles" sub="Les droits sont appliqués dans la base de données, pas seulement dans l’interface." />
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(ROLES) as MemberRole[]).map((r) => (
            <div key={r} className="rounded-2xl bg-surface-2 p-4"><dt className="font-semibold">{ROLES[r].label}</dt><dd className="mt-1 text-sm text-muted">{ROLES[r].can}</dd></div>
          ))}
        </dl>
      </Card>

      <Dialog open={open} onOpenChange={setOpen} title="Inviter un membre" description="La personne reçoit un lien valable 7 jours pour créer son accès."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={invite} loading={busy}><Mail aria-hidden />Envoyer l’invitation</Button></>}>
        <div className="grid gap-5">
          <Field label="E-mail" error={err}>{(a) => <Input id={a.id} type="email" aria-invalid={a.invalid} aria-describedby={a.describedBy} value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="prenom@exemple.com" autoFocus />}</Field>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">Rôle</legend>
            {(["manager", "editor", "viewer"] as const).map((r) => (
              <label key={r} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3.5 has-[:checked]:border-gold has-[:checked]:bg-gold/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/40">
                <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1 size-4 accent-[var(--color-gold)]" />
                <span><span className="block text-sm font-semibold">{ROLES[r].label}</span><span className="text-[13px] text-muted">{ROLES[r].can}</span></span>
              </label>
            ))}
          </fieldset>
        </div>
      </Dialog>
      <Dialog open={!!target} onOpenChange={(o) => !o && setRevoke(null)} title={target?.status === "invited" ? "Annuler l’invitation ?" : `Retirer ${target?.name ?? target?.email} ?`}
        description={target?.status === "invited" ? "Le lien envoyé ne fonctionnera plus." : "Cette personne perd immédiatement l’accès à l’espace. Ses messages et devis restent visibles."}
        footer={<><Button variant="ghost" onClick={() => setRevoke(null)}>Annuler</Button><Button variant="danger" onClick={() => { if (revoke) acc.revoke(revoke); setRevoke(null); }}>{target?.status === "invited" ? "Annuler l’invitation" : "Retirer l’accès"}</Button></>}>
        <p className="text-sm text-muted">Vous pourrez l’inviter de nouveau plus tard.</p>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------
   Langue et région
   --------------------------------------------------------- */
const LOCALES: { id: Locale; label: string; native: string; ready: boolean }[] = [
  { id: "fr", label: "Français", native: "Français", ready: true },
  { id: "en", label: "Anglais", native: "English", ready: false },
  { id: "ln", label: "Lingala", native: "Lingála", ready: false },
  { id: "sw", label: "Swahili", native: "Kiswahili", ready: false },
];
function Langue() {
  const { data } = useEspace();
  const acc = useAccount();
  return (
    <Card>
      <CardHeader title="Langue et région" />
      <fieldset className="grid max-w-xl gap-2">
        <legend className="mb-2 text-sm font-semibold">Langue de l’interface</legend>
        {LOCALES.map((l) => (
          <label key={l.id} className={cn("flex h-14 items-center gap-3 rounded-2xl border border-line px-4 has-[:checked]:border-gold has-[:checked]:bg-gold/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/40", l.ready ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
            <input type="radio" name="locale" checked={data.settings.locale === l.id} disabled={!l.ready} onChange={() => { acc.saveSettings({ locale: l.id }); toast.success("Langue enregistrée"); }} className="size-4 accent-[var(--color-gold)]" />
            <span className="font-semibold" lang={l.id}>{l.native}</span>
            {l.native !== l.label && <span className="text-sm text-muted">{l.label}</span>}
            {!l.ready && <span className="ml-auto text-xs font-semibold text-muted">Bientôt</span>}
          </label>
        ))}
      </fieldset>
      <div className="mt-6 grid max-w-xl gap-1.5">
        <span className="text-sm font-semibold" id="cur-l">Devise par défaut</span>
        <p className="text-[13px] text-muted">Utilisée pour vos nouveaux forfaits, devis et factures.</p>
        <Segmented layoutId="def-cur" label="Devise par défaut" value={data.settings.displayCurrency} onChange={(v) => { acc.saveSettings({ displayCurrency: v }); toast.success(`Devise par défaut : ${v}`); }}
          options={[{ value: "USD", label: "Dollar (USD)" }, { value: "CDF", label: "Franc congolais (CDF)" }]} className="mt-1 self-start" />
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------
   Données et suppression
   --------------------------------------------------------- */
function Suppression() {
  const { data, vendor, user } = useEspace();
  const acc = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const owner = data.members.find((m) => m.you)?.role === "owner";

  const exportData = () => {
    const payload = { exportedAt: new Date().toISOString(), compte: user, vitrine: vendor, ...data, media: data.media.map(({ url, ...m }) => ({ ...m, url: url.startsWith("blob:") ? "(fichier local)" : url })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `eclat-${vendor.slug || "vitrine"}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    toast.success("Export prêt", { description: "Vos données au format JSON (forfaits, demandes, messages, avis, statistiques)." });
  };

  const destroy = async () => {
    setBusy(true);
    const ok = await remote5.deleteAccount();
    if (!ok) { setBusy(false); toast.error("La suppression a échoué. Contactez le support si le problème persiste."); return; }
    if (!getSupabase()) {
      Object.keys(localStorage).filter((k) => k.startsWith("eclat.")).forEach((k) => localStorage.removeItem(k));
      try { for (const k of await keys()) if (String(k).startsWith("eclat-media:")) await del(k); } catch { /* IndexedDB indisponible */ }
    }
    await signOut();
    toast.success("Votre compte a été supprimé. Merci d’avoir utilisé NDOA Wedding.");
    router.replace("/");
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold-ink"><Download className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1"><h2 className="font-display text-xl">Exporter mes données</h2><p className="mt-1 text-sm text-muted">Un fichier avec votre vitrine, vos forfaits, demandes, messages, avis et statistiques.</p></div>
          <Button variant="outline" size="sm" onClick={exportData}>Télécharger</Button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold/12 text-gold-ink"><PauseCircle className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 font-display text-xl">Mettre ma vitrine en pause {data.settings.paused && <StatusTag tone="gold">En pause</StatusTag>}</h2>
            <p className="mt-1 text-sm text-muted">Votre page n’apparaît plus dans les recherches et ne reçoit plus de demandes. Tout reste intact, vous la réactivez quand vous voulez.</p>
          </div>
          <Switch checked={data.settings.paused} label="Vitrine en pause" onChange={(v) => { acc.saveSettings({ paused: v }); toast.success(v ? "Vitrine mise en pause" : "Vitrine de nouveau en ligne"); }} />
        </div>
      </Card>

      <Card className="border-danger/40">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-danger/10 text-danger"><Trash2 className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">Supprimer mon compte</h2>
            <p className="mt-1 text-sm text-muted">Supprime définitivement votre compte, votre vitrine, vos photos et vidéos, vos demandes et vos avis. {data.plan !== "free" && "Votre abonnement est arrêté sans remboursement de la période en cours."}</p>
            {!owner && <p className="mt-2 text-sm text-muted">Seul le propriétaire de la vitrine peut la supprimer.</p>}
          </div>
          <Button variant="danger" size="sm" onClick={() => { setTyped(""); setAck(false); setOpen(true); }} disabled={!owner}>Supprimer…</Button>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)} title="Supprimer définitivement ?" description="Cette action est irréversible. Pensez à exporter vos données avant."
        footer={<><Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button><Button variant="danger" onClick={destroy} loading={busy} disabled={typed.trim() !== vendor.name.trim() || !ack}>Supprimer mon compte</Button></>}>
        <div className="grid gap-4">
          <Field label={<>Tapez <strong className="font-semibold text-text">{vendor.name}</strong> pour confirmer</>}>
            {(a) => <Input id={a.id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />}
          </Field>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-danger)]" />
            Je comprends que mes {data.media.length} médias, {data.inquiries.length} demandes et {data.reviews.length} avis seront supprimés.
          </label>
        </div>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */
export function Parametres({ section }: { section: SectionId }) {
  const nav = useRef<HTMLElement>(null);
  // Sur mobile, la section active reste visible dans la barre défilante
  useLayoutEffect(() => { nav.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" }); }, [section]);
  const content = useMemo(() => ({ compte: <Compte />, securite: <Securite />, notifications: <Notifications />, equipe: <Equipe />, langue: <Langue />, suppression: <Suppression /> }), []);
  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Paramètres</em></h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav ref={nav} aria-label="Sections des paramètres" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-24 lg:mx-0 lg:self-start lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 lg:grid lg:gap-1">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <Link href={`/espace/parametres/${s.id}`} aria-current={s.id === section ? "page" : undefined}
                  className={cn("flex h-11 items-center gap-2.5 rounded-full border px-4 text-sm font-semibold transition-colors lg:rounded-xl lg:border-0",
                    s.id === section ? "border-gold bg-gold/12 text-text" : "border-line text-muted hover:bg-surface-2 hover:text-text")}>
                  <s.icon className={cn("size-4", s.id === section ? "text-gold-ink" : "")} aria-hidden />{s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{content[section]}</div>
      </div>
    </div>
  );
}

export function ParametresSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement des paramètres">
      <Skeleton className="h-14 w-60" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="hidden gap-2 lg:grid">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}</div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
    </div>
  );
}
