"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Msg = { id: string; sender: "vendor" | "couple" | "system"; body: string | null; created_at: string; quote_id: string | null };

const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Fil d'une demande de devis côté marié : la demande, les réponses du prestataire, et une zone pour répondre */
export function InquiryThread({ inquiryId, userId, vendorName, request }: { inquiryId: string; userId: string; vendorName: string; request: string | null }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase()!.from("messages").select("id, sender, body, created_at, quote_id")
      .eq("inquiry_id", inquiryId).order("created_at", { ascending: true }).limit(200);
    setMsgs((data ?? []) as Msg[]);
  }, [inquiryId]);

  useEffect(() => {
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    if (body.length > 2000) return setErr("Message trop long (2 000 caractères maximum).");
    setSending(true); setErr("");
    const { error } = await getSupabase()!.from("messages").insert({ inquiry_id: inquiryId, sender: "couple", sender_id: userId, body });
    setSending(false);
    if (error) return setErr("Le message n’a pas pu être envoyé. Réessayez.");
    setText("");
    void load();
  }

  return (
    <div className="th">
      <div className="th-list" aria-live="polite">
        {request && (
          <div className="th-msg me">
            <p>{request}</p>
            <small>Votre demande</small>
          </div>
        )}
        {msgs === null ? <p className="th-note" aria-busy="true">Chargement…</p> : msgs.length === 0 ? (
          <p className="th-note">{vendorName} n’a pas encore répondu. Vous serez prévenu par la cloche en haut de la page.</p>
        ) : msgs.map((m) => (
          <div key={m.id} className={`th-msg${m.sender === "couple" ? " me" : m.sender === "system" ? " sys" : ""}`}>
            {m.body && <p>{m.body}</p>}
            {m.quote_id && <p className="th-quote">Devis joint : consultez-le avec {vendorName} ou demandez-le sur WhatsApp.</p>}
            <small>{m.sender === "couple" ? "Vous" : m.sender === "system" ? "NDOA" : vendorName} · {when(m.created_at)}</small>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="th-form" onSubmit={send}>
        <label className="sr-only" htmlFor={`th-${inquiryId}`}>Votre message à {vendorName}</label>
        <textarea id={`th-${inquiryId}`} value={text} onChange={(e) => { setText(e.target.value); setErr(""); }} maxLength={2000} rows={2}
          placeholder={`Écrire à ${vendorName}…`} onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(e); }} />
        <button type="submit" className="btn btn-gold" disabled={sending || !text.trim()} aria-busy={sending}>{sending ? "Envoi…" : "Envoyer"}</button>
      </form>
      {err && <p className="th-err" role="alert">{err}</p>}
    </div>
  );
}
