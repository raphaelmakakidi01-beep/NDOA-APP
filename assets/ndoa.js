/* =========================================================
   NDOA Wedding — configuration publique et appels Supabase
   ---------------------------------------------------------
   Aucune clé secrète ici : l'« anon key » Supabase est publique
   par conception, la sécurité repose sur la RLS et les fonctions
   submit_inquiry / track_event (voir supabase/migrations).
   Sans SUPABASE_URL, le site fonctionne en mode démonstration.
   ========================================================= */
window.NDOA = (() => {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const cfg = {
    SITE_URL: local ? location.origin : 'https://ndoa.cd',
    PRO_URL: local ? 'http://localhost:3000' : 'https://pro.ndoa.cd',
    SUPABASE_URL: '',       // ex. https://xxxx.supabase.co
    SUPABASE_ANON_KEY: '',  // clé publique « anon »
  };
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  async function rpc(fn, body) {
    const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || `HTTP ${r.status}`); }
    return r.status === 204 ? null : r.json();
  }

  // Identifiant anonyme de visite, pour dédoublonner les statistiques (aucune donnée personnelle)
  function visitor() {
    try {
      let v = localStorage.getItem('ndoa.visitor');
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)); localStorage.setItem('ndoa.visitor', v); }
      return v;
    } catch { return null; }
  }

  // Provenance de la visite, alignée sur les sources de l'espace « Statistiques »
  function source() {
    const p = new URLSearchParams(location.search).get('src');
    if (p) return p.slice(0, 30);
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch { /* référent illisible */ }
    if (!ref) return 'direct';
    if (/instagram|tiktok|facebook/.test(ref)) return 'instagram';
    if (/whatsapp|wa\.me/.test(ref)) return 'whatsapp';
    if (ref === location.hostname) return document.referrer.includes('categorie=') ? 'categorie' : 'recherche';
    return 'direct';
  }

  const MESSAGES = {
    RATE_LIMITED: 'Vous avez déjà envoyé plusieurs demandes à ce prestataire aujourd’hui. Il vous répondra très vite.',
    DATE_INVALID: 'La date du mariage doit être dans le futur (3 ans maximum).',
    CONTACT_REQUIRED: 'Laissez un numéro de téléphone ou une adresse e-mail.',
    EMAIL_INVALID: 'L’adresse e-mail semble incorrecte.',
    PHONE_INVALID: 'Le numéro de téléphone semble incorrect.',
    NAMES_INVALID: 'Indiquez vos prénoms.',
    VENDOR_NOT_FOUND: 'Ce prestataire n’accepte plus de demandes pour le moment.',
  };
  const explain = (msg) => MESSAGES[Object.keys(MESSAGES).find((k) => msg.includes(k))] || 'L’envoi a échoué. Vérifiez votre connexion et réessayez.';

  // Liens vers l'espace prestataire (autre application) : <a data-pro="/inscription">
  const wirePro = () => document.querySelectorAll('a[data-pro]').forEach((a) => { a.href = cfg.PRO_URL + a.dataset.pro; });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wirePro); else wirePro();

  return {
    ...cfg,
    live,
    /** Statistiques : vue de profil, clic WhatsApp / appel, partage, photo ouverte */
    track(slug, event, extra = {}) {
      if (!live || !slug) return;
      rpc('track_event', { p_vendor_slug: slug, p_event: event, p_source: extra.source || source(), p_media_id: extra.mediaId || null, p_visitor: visitor() }).catch(() => {});
    },
    /** Demande de devis : renvoie { ok } ou { ok:false, error } avec un message lisible */
    async submitInquiry(payload) {
      if (!live) { await new Promise((r) => setTimeout(r, 700)); return { ok: true, demo: true }; }
      try {
        const id = await rpc('submit_inquiry', { ...payload, p_source: payload.p_source || source() });
        return { ok: true, id };
      } catch (e) {
        return { ok: false, error: explain(String(e.message || e)) };
      }
    },
  };
})();
