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
    SITE_URL: location.origin,
    // Espace prestataire : remplacé au déploiement par PRO_URL (scripts/build-public.mjs)
    PRO_URL: local ? 'http://localhost:3000' : 'https://pro.ndoa.cd',
    SUPABASE_URL: 'https://ekjfvoqlguxflpxvnqjj.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_rY75WwZGJGEJvNFPQoToMg_F-OLXvl7',  // clé publique (protégée par RLS)
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

  // Lecture publique en GET avec la clé dans l'URL : requête « simple », sans pré-vol CORS (une aller-retour de moins sur mobile)
  async function get(path, ms = 6000) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${path}${path.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(cfg.SUPABASE_ANON_KEY)}`, { signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  const once = (fn) => { let p; return () => (p ??= fn()); };

  /* ---------- Images ----------
     Une image est soit un identifiant Unsplash (données de démo), soit un chemin du site (/assets/…),
     soit { b: bucket, p: chemin } dans le stockage public Supabase (vignettes par transformation d'image). */
  let noTransform = false;
  try { noTransform = sessionStorage.getItem('ndoa.notx') === '1'; } catch { /* stockage indisponible */ }
  const objectUrl = (r) => `${cfg.SUPABASE_URL}/storage/v1/object/public/${r.b}/${String(r.p).split('/').map(encodeURIComponent).join('/')}`;
  function img(r, w = 900, h) {
    if (!r) return '/assets/brand/og-ndoa.jpg';
    if (typeof r === 'string') return r.startsWith('/') || /^https?:/.test(r) ? r : `https://images.unsplash.com/photo-${r}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=72`;
    if (noTransform) return objectUrl(r);
    return objectUrl(r).replace('/object/public/', '/render/image/public/') + `?width=${w}${h ? `&height=${h}&resize=cover` : ''}&quality=72`;
  }
  const srcset = (r, w, h) => (r && typeof r === 'string' && /^(\/|https?:)/.test(r)) || (r && typeof r === 'object' && noTransform) ? ''
    : [Math.round(w / 2), w].map((x) => `${img(r, x, h ? Math.round(h * x / w) : undefined)} ${x}w`).join(', ');
  // Transformations d'image indisponibles (offre Supabase) : toutes les images basculent sur le fichier d'origine
  const RENDER = '/storage/v1/render/image/public/';
  const raw = (el) => { el.removeAttribute('srcset'); el.src = el.getAttribute('src').replace('/render/image/public/', '/object/public/').replace(/\?.*$/, ''); };
  document.addEventListener('error', (e) => {
    if (!(e.target instanceof HTMLImageElement) || !e.target.getAttribute('src')?.includes(RENDER)) return;
    noTransform = true;
    try { sessionStorage.setItem('ndoa.notx', '1'); } catch { /* stockage indisponible */ }
    document.querySelectorAll(`img[src*="${RENDER}"]`).forEach(raw);
  }, true);

  /* ---------- Données publiques ---------- */
  const media = (p) => (p ? { b: 'vendor-media', p } : null);
  /** Carte prestataire (format commun à l'accueil, aux profils similaires et au SEO) */
  function card(v) {
    const cover = media(v.cover_path), photos = (v.photos || []).map(media);
    const gallery = photos.length ? photos : [cover || '/assets/brand/og-ndoa.jpg'];
    return {
      live: true, slug: v.slug, name: v.name, cat: v.category || '', catName: v.category_name || '', city: v.city, quote: v.tagline || '',
      rating: Number(v.rating_avg) || 0, reviews: v.rating_count || 0, likes: v.followers_count || 0,
      price: v.price_from == null ? null : Number(v.price_from), verified: !!v.is_verified, recommended: !!v.is_recommended,
      avatar: media(v.avatar_path) || cover || '/assets/brand/icon-512.png', cover: cover || gallery[0], gallery,
    };
  }
  const nonEmpty = (x) => (Array.isArray(x) && x.length ? x : null);
  /** Contenu de l'accueil géré depuis l'admin (null si indisponible : la page garde ses données de démo) */
  const home = once(async () => {
    if (!live) return null;
    try {
      const h = await get('rpc/get_home_content', 2500);
      return {
        slides: (h.slides || []).map((s) => {
          const r = s.image_path ? { b: 'site-media', p: s.image_path } : media(s.media_kind === 'video' ? s.poster_path : s.media_path);
          return r && { img: r, video: s.media_kind === 'video', title: s.title || '', subtitle: s.subtitle || '', vendor: card(s.vendor) };
        }).filter(Boolean),
        feature: h.a_la_une ? card(h.a_la_une) : null,
        picks: (h.recommandations || []).map(card),
        stories: (h.stories || []).map((s) => {
          const v = card(s.vendor), items = (s.items || []).map((i) => ({ img: media(i.path), caption: i.caption || '' })).filter((i) => i.img);
          const cover = media(s.cover_path) || items[0]?.img || v.cover;
          return { ...v, story: s.title, ring: cover, frames: items.length ? items : [{ img: cover, caption: '' }] };
        }),
        categories: (h.categories || []).map((c) => ({ key: c.slug, name: c.name_plural || c.name, label: c.name, count: c.vendor_count || 0, img: c.image_path ? { b: 'site-media', p: c.image_path } : null })),
        cities: (h.cities || []).map((c) => c.name),
      };
    } catch { return null; }
  });
  /** Annuaire des vitrines publiées (null si indisponible ou vide) */
  const vendors = once(async () => {
    if (!live) return null;
    try { return nonEmpty((await get('rpc/get_public_vendors')).map(card)); } catch { return null; }
  });
  /** Vitrine publiée complète (null si absente : la page bascule sur les profils de démo) */
  async function profile(slug) {
    if (!live || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
    const sel = 'id,slug,name,tagline,bio,style_tags,city,zones,languages,avatar_path,phone,whatsapp,details,is_verified,is_recommended,'
      + 'rating_avg,rating_count,followers_count,response_minutes,cover:media!vendors_cover_fk(storage_path,kind,status),'
      + 'vendor_categories(is_primary,categories(slug,name,name_plural,detail_schema)),'
      + 'media!media_vendor_id_fkey(id,kind,storage_path,poster_path,width,height,alt,duration_s,sort,albums!media_album_id_fkey(title)),'
      + 'packages(id,name,description,price_mode,price_amount,currency,duration_label,includes,excludes,is_featured,sort),'
      + 'package_options(id,name,price_amount,currency,sort),'
      + 'reviews(author_names,photo_path,wedding_date,city,rating,body,reply,created_at),'
      + 'stories(id,title,sort,cover_media_id,story_items(caption,sort,media(kind,storage_path,poster_path)))';
    const q = `vendors?slug=eq.${slug}&status=eq.published&select=${encodeURIComponent(sel)}`
      + '&media.status=eq.ready&media.order=sort,created_at&packages.is_visible=eq.true&packages.order=sort'
      + '&package_options.order=sort&reviews.status=eq.published&reviews.order=created_at.desc&reviews.limit=30'
      + '&stories.is_archived=eq.false&stories.order=sort&stories.story_items.order=sort';
    try {
      const [rows, days] = await Promise.all([get(q), get(`rpc/get_public_availability?p_vendor_slug=${slug}`).catch(() => [])]);
      return rows[0] ? { ...rows[0], availability: days } : null;
    } catch { return null; }
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
    img, srcset, media, card, home, vendors, profile,
    /** URL directe d'un fichier du stockage public (vidéos) */
    file: (r) => (r ? objectUrl(r) : ''),
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
