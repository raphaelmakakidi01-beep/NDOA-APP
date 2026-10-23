"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEMO } from "@/lib/config";
import { useCouple } from "@/lib/public/couple";
import type { Card } from "@/lib/public/types";
import { getSupabase } from "@/lib/supabase/client";
import { vendorUrl } from "./format";
import { VendorCard } from "./vendor-card";

type Inquiry = { id: string; createdAt: string; weddingDate: string | null; status: string; vendor: { slug: string; name: string } | null };
const STATUS: Record<string, string> = { new: "Envoyée", discussing: "En discussion", quote_sent: "Devis reçu", confirmed: "Confirmée", lost: "Close" };
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Compte couple : favoris, prestataires suivis, historique des demandes de devis */
export function Account({ vendors }: { vendors: Card[] }) {
  const couple = useCouple();
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(DEMO ? [] : null);
  const [tab, setTab] = useState<"favoris" | "suivis" | "demandes">("favoris");

  useEffect(() => {
    if (!couple.userId || DEMO) return;
    getSupabase()!.from("inquiries").select("id, created_at, wedding_date, status, vendors(slug, name)").eq("couple_user_id", couple.userId)
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setInquiries((data ?? []).map((r) => {
        const v = (Array.isArray(r.vendors) ? r.vendors[0] : r.vendors) as { slug: string; name: string } | null;
        return { id: r.id as string, createdAt: r.created_at as string, weddingDate: r.wedding_date as string | null, status: r.status as string, vendor: v };
      })));
  }, [couple.userId]);

  if (!couple.ready) return <p aria-busy="true" style={{ color: "var(--muted)" }}>Chargement…</p>;
  if (!couple.userId) {
    return (
      <div className="join">
        <h2>Votre <em className="gold-text">compte</em>, si vous le souhaitez</h2>
        <p>Aucun compte n’est nécessaire pour demander un devis. Avec un compte, vous retrouvez vos favoris, vos prestataires suivis et l’historique de vos demandes.</p>
        <div className="cta-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btn-gold" href="/inscription?compte=couple">Créer un compte</Link>
          <Link className="btn btn-ghost" href="/connexion?suite=/mon-compte&compte=couple">Se connecter</Link>
        </div>
      </div>
    );
  }

  const favorites = vendors.filter((v) => couple.favorites.has(v.id));
  const follows = vendors.filter((v) => couple.follows.has(v.id));
  const tabs = [["favoris", `Favoris (${favorites.length})`], ["suivis", `Suivis (${follows.length})`], ["demandes", `Mes demandes${inquiries ? ` (${inquiries.length})` : ""}`]] as const;
  const signOut = async () => { if (!DEMO) await getSupabase()?.auth.signOut(); location.href = "/"; };
  const list = tab === "favoris" ? favorites : follows;

  return (
    <>
      <div className="g-filters" role="tablist" aria-label="Mon compte">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" className="chip" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        <span className="sep" aria-hidden="true" />
        <button type="button" className="chip" onClick={signOut}>Se déconnecter</button>
      </div>
      {tab !== "demandes" ? (
        list.length ? <div className="feed" style={{ marginTop: 24 }}>{list.map((v) => <VendorCard key={v.id} v={v} />)}</div> : (
          <div className="empty" style={{ marginTop: 24 }}>
            <strong>{tab === "favoris" ? "Aucun favori pour l’instant." : "Vous ne suivez encore personne."}</strong>
            {tab === "favoris" ? "Touchez ♥ sur une carte pour garder un prestataire sous la main." : "Touchez « Suivre » sur un profil pour ne rien manquer de ses réalisations."} <Link href="/prestataires">Explorer les prestataires →</Link>
          </div>
        )
      ) : !inquiries ? <p aria-busy="true" style={{ color: "var(--muted)", marginTop: 24 }}>Chargement…</p> : inquiries.length ? (
        <ul className="reviews" style={{ marginTop: 24, listStyle: "none", padding: 0 }}>
          {inquiries.map((q) => (
            <li key={q.id} className="review">
              <div className="rv-top"><div><strong>{q.vendor ? <Link href={vendorUrl(q.vendor.slug)}>{q.vendor.name}</Link> : "Prestataire indisponible"}</strong>
                <small>Envoyée le {day(q.createdAt)}{q.weddingDate ? ` · mariage le ${day(q.weddingDate)}` : ""}</small></div>
                <span className="pp-reco" style={{ marginLeft: "auto" }}>{STATUS[q.status] ?? q.status}</span></div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty" style={{ marginTop: 24 }}><strong>Aucune demande pour l’instant.</strong>Les demandes de devis envoyées en étant connecté apparaissent ici. <Link href="/prestataires">Trouver un prestataire →</Link></div>
      )}
    </>
  );
}
