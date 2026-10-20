# Audit avant mise en production — NDOA Wedding

Date : 20 octobre 2026 · Périmètre : site public (HTML statique), espace prestataire (Next.js), base Supabase.

Légende : **P0** bloquant · **P1** important · **P2** à corriger avant l’ouverture · **P3** amélioration.
Statut : ✅ corrigé et vérifié · 🟡 corrigé, à vérifier sur le vrai projet Supabase · ⬜ à faire de votre côté.

---

## 1. Problèmes trouvés, par priorité

| # | Prio | Domaine | Problème | Statut |
|---|------|---------|----------|--------|
| B1 | P0 | Bug | **Création de vitrine impossible avec Supabase** : l’onboarding fait `insert().select()`, la règle de lecture exigeait un membre créé *après* l’insertion → erreur 42501. | ✅ |
| B2 | P0 | Bug | **Les demandes de devis n’arrivaient jamais** : le formulaire du profil public ne faisait qu’une démonstration, et aucune voie sécurisée n’existait pour qu’un visiteur crée une demande. | ✅ |
| S1 | P0 | Sécurité | Un **éditeur** pouvait changer le **propriétaire** de la vitrine, la note moyenne, le nombre d’abonnés, et publier/dépublier. | ✅ |
| S2 | P0 | Sécurité | Un membre de l’équipe pouvait **masquer un avis négatif** (changer son statut) ou modifier sa vérification. | ✅ |
| S3 | P1 | Sécurité | L’équipe pouvait **réécrire les messages des couples** (la règle « marquer comme lu » autorisait toutes les colonnes). Idem pour les notifications. | ✅ |
| S4 | P1 | Sécurité | Taille et type des médias **déclarés par le navigateur** : quotas contournables, vidéo enregistrée comme photo, chemin hors du dossier du prestataire. | ✅ |
| S5 | P1 | Sécurité | Un gérant pouvait ajouter un membre **actif sans invitation**, et un membre pouvait modifier son propre rôle. | ✅ |
| S9 | P1 | Sécurité | **Redirection ouverte** : le paramètre `?suite=` de la connexion et du retour Google acceptait `//site-pirate.com` ou `/\site-pirate.com` → hameçonnage possible après connexion. | ✅ |
| B3 | P1 | Bug | Aucune collecte des **statistiques** (vues, clics WhatsApp/appel) depuis le site public : la page Statistiques serait restée vide. | ✅ |
| B4 | P1 | Bug | **15 liens cassés** sur le site public (`/devenir-prestataire`, `/connexion`, `/explorer`, `/categorie/…`, `/ville/…`, `/aide`, `/contact`, `/cgu`, `/confidentialite`, `/mentions-legales`, `/tarifs`) + `/cgu` et `/confidentialite` dans l’inscription. | ✅ |
| P1 | P1 | Performance | Lighthouse mobile : **accueil 52**, profil 67, à propos 78 (objectif > 85). | ✅ |
| SEO1 | P1 | SEO | Aucune balise **Open Graph / Twitter** : aperçus vides sur WhatsApp et Instagram. | ✅ |
| SEO2 | P1 | SEO | Profils en `prestataire.html?slug=…`, titre et description posés **en JavaScript** : invisibles pour Google et les aperçus de partage. | ✅ |
| SEO3 | P1 | SEO | Pas de `sitemap.xml`, pas de `robots.txt`, pas d’URL canonique ; espace prestataire indexable. | ✅ |
| S6 | P2 | Sécurité | **Injection HTML** possible sur le site public : une dizaine de champs (nom de forfait, ville, témoignage, langues…) insérés sans échappement ; numéros de téléphone bruts dans les liens. | ✅ |
| S7 | P2 | Sécurité | Pas d’**en-têtes de sécurité** (CSP, anti-iframe, HSTS, nosniff). | ✅ |
| S8 | P2 | Sécurité | Contrôle des fichiers uniquement sur l’**extension** : un fichier renommé en `.jpg` passait. | ✅ |
| B5 | P2 | Bug | Renvoi d’un devis : le PDF ne pouvait pas être **remplacé** dans le stockage privé (règle manquante). | ✅ |
| B6 | P2 | Bug | Pas de **page 404**. | ✅ |
| A1 | P3 | Accessibilité | Noms accessibles différents du texte visible (stories, crédit photo, portrait à la une). | ✅ |
| Q1 | P3 | Qualité | Zod tentait `new Function` (bloqué par la CSP) → alerte dans la console. | ✅ |

## 2. Ce qui a été corrigé

### Sécurité (Supabase) — `supabase/migrations/20261021000000_audit_securite.sql`
- **RLS active sur les 28 tables** (vérifié) ; chaque écriture passe par `has_vendor_role(vendor_id, rôle)` : un prestataire ne modifie que ses propres données.
- Garde-fous en base (triggers) : champs système des vitrines, avis en lecture seule (sauf réponse), messages et notifications (seul `read_at` modifiable), **vérification des médias contre le fichier réellement stocké** (taille, type MIME, dossier).
- Équipe : ajout uniquement par invitation, pas d’auto-promotion, propriétaire intouchable.
- Points d’entrée publics : `submit_inquiry` (validation + **anti-abus** : 3 demandes / 24 h par contact et par prestataire, 20 / heure) et `track_event` (événements autorisés uniquement, dédoublonnés 30 min par visiteur anonyme).
- **Tests automatisés : `supabase/tests` — 31/31 contrôles réussis** (migrations exécutées sur un vrai moteur PostgreSQL, PGlite).
  ```
  cd supabase/tests && npm install && npm test
  ```
- Clés : seules l’URL et la clé **publique** (`anon`) sont côté navigateur. La clé `service_role` et les secrets de paiement ne vivent que dans les Edge Functions. Aucun secret trouvé dans le code client.
- Fichiers : contrôle de la **signature binaire** (JPEG, PNG, WebP, AVIF, MP4/MOV, WebM) avant envoi + limites de taille par offre ; le bucket Supabase limite aussi types et taille.
- En-têtes HTTP : `web/next.config.ts` (espace prestataire) et `_headers` (site public).

### Performance
| Page (mobile) | Avant | Après |
|---|---|---|
| Accueil | 52 | **88 – 99** |
| Profil prestataire | 67 | **89 – 95** |
| À propos | 78 | **96** |
| Contact | — | **100** |
| Espace pro : accueil / connexion / inscription | 95 / 89 / 88 | voir note |

Mesures Lighthouse 12, profil mobile, site servi compressé (comme en production).
Principaux leviers : animations GSAP/Lenis chargées **seulement sur grand écran** (1,4 s de calcul évité sur mobile), premier affichage avant le rendu JavaScript, rendu par étapes, `content-visibility` sur les sections hors écran, **polices auto-hébergées** et préchargées, images `srcset` adaptées à l’écran, logo de 9 Ko au lieu de 30 Ko, préchargement responsive de l’image du héros.

Espace pro (Next.js) :
- `supabase-js` chargé **à la demande** : JavaScript de la page de connexion 274 → 216 Ko.
- Zod en mode sans `new Function` (compatible CSP) et sans import global de la bibliothèque.
- Formulaire de connexion **pré-rendu côté serveur** (visible avant le JavaScript).
- Accessibilité, bonnes pratiques et SEO : **100 / 100 / 100** sur les trois pages.

> Note : en fin d’audit, la machine de test était fortement ralentie et instable (indice CPU Lighthouse entre 390 et 1 200, contre ≈ 1 600 au début). Dans ces conditions, l’espace pro mesure **79 – 86** en performance (FCP ≈ 1 s, LCP 3,3 – 4 s), avec un creux isolé à 64. Ces chiffres ne sont pas comparables à ceux du début : **refaire la mesure sur le serveur de production** (ou PageSpeed Insights) après la mise en ligne.

### SEO
- `scripts/build-seo.mjs` : titre, description, **canonical, Open Graph, Twitter Card et JSON-LD** (Organization, WebSite, LocalBusiness avec note) sur chaque page.
- **Une page par prestataire** : `/prestataire/<slug>/` (12 pages), lisible sans JavaScript, avec son image de partage.
- `sitemap.xml` (18 URL) et `robots.txt` ; image de partage 1200×630 `assets/brand/og-ndoa.jpg`.
- Espace prestataire : `robots.txt`, `sitemap.xml`, Open Graph ; espace et onboarding en **noindex**.

### Bugs et liens
- Formulaire de devis branché sur `submit_inquiry`, avec messages d’erreur clairs (limite atteinte, date passée, contact manquant…).
- Statistiques du profil : vue, clic WhatsApp, appel, partage.
- Nouvelles pages : `contact.html` (+ FAQ pour « Centre d’aide »), `cgu.html`, `confidentialite.html`, `mentions-legales.html`, `404.html`.
- Liens catégories/villes → filtres de l’accueil (`/?categorie=dj&ville=Kinshasa#feed`).
- Liens vers l’espace pro centralisés (`data-pro`, réglés dans `assets/ndoa.js`).
- **Contrôle des liens : 19 chemins internes, 0 erreur.**

## 3. À faire de votre côté avant la mise en ligne ⬜

1. **Domaines** : confirmer `ndoa.cd` (site) et `pro.ndoa.cd` (espace). Sinon, modifier :
   - `assets/ndoa.js` (`SITE_URL`, `PRO_URL`) ;
   - `SITE_URL=https://… node scripts/build-seo.mjs` ;
   - `NEXT_PUBLIC_PUBLIC_SITE_URL` et `NEXT_PUBLIC_APP_URL` dans l’espace pro.
2. **Supabase** : créer le projet, puis `supabase db push` (3 migrations) et `supabase/seed.sql`. Renseigner `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `assets/ndoa.js` et `web/.env.local`.
3. **Edge Functions** : déployer `supabase/functions/*` avec les secrets `PAYMENT_API_URL`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, `SITE_URL`.
4. **Textes juridiques** : faire compléter et valider `cgu.html`, `confidentialite.html`, `mentions-legales.html` (les éléments entre crochets sont signalés en surbrillance sur les pages).
5. **Contact** : remplacer le numéro WhatsApp `243000000000` et l’adresse `bonjour@ndoa.cd` dans `contact.html` s’ils ne sont pas les bons.
6. **Hébergement du site public** : le fichier `_headers` est prêt pour Netlify ou Cloudflare Pages. Ailleurs, reproduire les en-têtes et activer la compression gzip/brotli.
7. **Profils réels** : `scripts/build-seo.mjs` lit aujourd’hui les profils de démonstration. Une fois Supabase branché, lui faire lire les vitrines publiées (à prévoir) et le relancer à chaque publication, par exemple via un webhook de déploiement.
8. Relancer `npm test` dans `supabase/tests` après toute modification du schéma.
