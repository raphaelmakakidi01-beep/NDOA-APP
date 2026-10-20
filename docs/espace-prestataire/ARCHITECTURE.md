# Éclat — Espace prestataire · Architecture (étape 1)

> Document de cadrage à valider avant de coder. Schéma SQL complet :
> [`supabase/migrations/20261019000000_schema_initial.sql`](../../supabase/migrations/20261019000000_schema_initial.sql),
> données de référence : [`supabase/seed.sql`](../../supabase/seed.sql).

---

## 1. Choix techniques

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js (App Router, dernière version stable)** + TypeScript | Rendu serveur pour la vitesse sur réseau mobile, Server Actions pour les formulaires, un seul dépôt pour le site public et l'espace prestataire. |
| UI | **Tailwind CSS v4 + shadcn/ui** (Radix) | Composants accessibles (clavier, ARIA) que l'on habille avec le design system Éclat. |
| Animations | **Framer Motion** (transitions, toasts, réordonnancement) + `canvas-confetti` (succès) | Animations sobres, toutes coupées si `prefers-reduced-motion`. |
| Données | **Supabase** : Auth, Postgres + RLS, Storage, Realtime, Edge Functions, `pg_cron` | Un seul fournisseur, sécurité au niveau des lignes, temps réel inclus. |
| Formulaires | Champs contrôlés + **Zod 4** (schémas partagés client/serveur) | Même validation des deux côtés. `react-hook-form` a été écarté : son adaptateur Zod est en conflit de dépendances avec cette version. |
| Données côté client | **TanStack Query** (cache, états chargement/erreur, mises à jour optimistes) | Gère proprement les états vide, chargement, erreur et succès. |
| Graphiques | **Recharts** | Léger, accessible, thémable clair/sombre. |
| Médias | Compression navigateur (`browser-image-compression` → WebP 2 560 px), recadrage `react-easy-crop`, envois reprenables **TUS** vers Supabase Storage, vignettes via les transformations d'images Supabase | Économise la data mobile et résiste aux coupures réseau. |
| Glisser-déposer | **dnd-kit** | Accessible au clavier, fonctionne au toucher. |
| Devis PDF | `@react-pdf/renderer` dans une route serveur | PDF aux couleurs Éclat, stocké dans le bucket privé. |
| OTP | Supabase Auth téléphone via **Twilio Verify**, canal SMS ou WhatsApp | Les deux canaux demandés ; à confirmer à la création du compte Twilio. |
| Paiement | **Agrégateur Mobile Money RDC** (M-Pesa, Orange Money, Airtel Money) + carte | Fournisseur à choisir (voir §9). Webhook signé → Edge Function → mise à jour de l'abonnement. |
| E-mails / WhatsApp | Resend (e-mail) · WhatsApp Business API (notifications) | Via une Edge Function `notify` qui lit `notification_prefs`. |
| Qualité | ESLint, Prettier, Vitest (unitaires), Playwright (parcours), axe-core (accessibilité) | Contrôle WCAG AA automatisé en CI. |

**Mode démo sans Supabase.** Tant que les clés Supabase ne sont pas renseignées, l'application lit un jeu de données de démonstration local (même interface `lib/data/*`). On peut donc tout parcourir et valider le design avant de brancher la vraie base.

---

## 2. Structure du dépôt

L'application Next.js vit dans le dossier `web/` (Next 16, React 19, Tailwind 4), à côté du site public statique.

```
web/
├─ app/
│  ├─ (public)/                 # site vitrine existant, migré en Next.js plus tard
│  ├─ (auth)/
│  │  ├─ inscription/page.tsx
│  │  ├─ connexion/page.tsx
│  │  └─ verification/page.tsx          # code OTP SMS / WhatsApp (mot de passe oublié : depuis la connexion)
│  ├─ onboarding/
│  │  ├─ layout.tsx                     # barre de progression + score
│  │  └─ [etape]/page.tsx               # activite · entreprise · photos · tarif · contacts · apercu
│  ├─ espace/
│  │  ├─ layout.tsx                     # sidebar / barre mobile / notifications temps réel
│  │  ├─ page.tsx                       # tableau de bord
│  │  ├─ vitrine/page.tsx
│  │  ├─ galerie/page.tsx · galerie/[albumId]/page.tsx · galerie/stories/page.tsx
│  │  ├─ tarifs/page.tsx · tarifs/[id]/page.tsx · tarifs/promotions/page.tsx
│  │  ├─ demandes/page.tsx (?vue=liste|kanban) · demandes/[id]/page.tsx · demandes/[id]/devis/page.tsx
│  │  ├─ calendrier/page.tsx
│  │  ├─ avis/page.tsx
│  │  ├─ statistiques/page.tsx
│  │  ├─ abonnement/page.tsx · abonnement/factures/page.tsx
│  │  ├─ parametres/[section]/page.tsx  # compte · securite · notifications · equipe · langue · suppression
│  │  └─ plus/page.tsx                  # menu « Plus » de la barre mobile
│  ├─ admin/                            # administrateur plateforme
│  │  ├─ page.tsx · prestataires/ · avis/ · categories/ · offres/
│  ├─ avis/[token]/page.tsx             # formulaire public de dépôt d'avis
│  └─ api/
│     ├─ devis/[id]/pdf/route.ts
│     ├─ uploads/sign/route.ts          # contrôle quota + URL d'envoi signée
│     └─ webhooks/paiement/route.ts
├─ components/ui/ (shadcn)  components/espace/  components/charts/
├─ lib/ supabase/ · data/ (requêtes + adaptateur démo) · validation/ (Zod) · format.ts (USD/CDF, dates FR)
├─ proxy.ts                            # (ex-middleware) session Supabase + protection des routes
└─ (racine du dépôt) supabase/ migrations/ · seed.sql · docs/
```

---

## 3. Pages et navigation

### Navigation
- **Desktop (≥ 1024 px)** : sidebar repliable (240 px → 72 px icônes), sélecteur de prestataire si l'utilisateur gère plusieurs vitrines, cloche de notifications avec badge, bascule clair/sombre, avatar.
- **Mobile** : barre d'onglets fixe en bas : **Accueil · Demandes · Galerie · Tarifs · Plus**. Badge rose poudré sur Demandes (non lus). « Plus » ouvre Vitrine, Calendrier, Avis, Statistiques, Abonnement, Paramètres.
- Raccourci global « + » : ajouter des photos, créer un forfait, publier une story.

### Inventaire des écrans

| Écran | Contenu clé | Rôle minimum |
|---|---|---|
| Inscription | E-mail ou téléphone + mot de passe, Google, CGU | — |
| Vérification | Code OTP 6 chiffres, choix SMS / WhatsApp, renvoi après 30 s | — |
| Onboarding 1 → 6 | Activité (multi-catégories) · entreprise · couverture + ≥ 6 photos · 1er forfait · contacts · aperçu + publication (confettis) | owner |
| Tableau de bord | Bienvenue + score, 6 KPI avec tendance 7/30 j, graphique vues/demandes, demandes à traiter, prochains événements, derniers avis, raccourcis | viewer |
| Ma vitrine | Formulaire par sections + aperçu en direct (bascule desktop / mobile), champs spécifiques à la catégorie | editor |
| Galerie | Glisser-déposer multi-fichiers, progression, albums, réorganisation, « à la une », jauge de stockage | editor |
| Stories | Créer, durée, ordre, archiver | editor |
| Tarifs | Liste, créer/modifier/dupliquer/masquer, « Le plus populaire », options, promotions datées | editor |
| Demandes | Liste filtrable + Kanban (5 colonnes), recherche, assignation | viewer (lecture) / editor |
| Conversation | Fil de messages, réponses rapides, « Continuer sur WhatsApp », envoi de devis | editor |
| Devis | Généré depuis un forfait, lignes, remise, validité, aperçu PDF, envoi | editor |
| Calendrier | Mois, réservé / option / bloqué, blocage par plage, lien vers la demande | editor |
| Avis | Liste, réponse publique, lien de collecte à partager | editor |
| Statistiques | Vues, sources, taux de clic, top photos, conversion, comparaison à la catégorie | manager (avancé : offre Pro+) |
| Abonnement | 3 offres, Mobile Money / carte, factures | owner |
| Paramètres | Compte, sécurité (mot de passe, sessions), notifications par canal, équipe et rôles, langue, suppression | owner / manager selon section |
| Admin | Prestataires (vérifier, recommander, suspendre), modération des avis, catégories, offres | administrateur plateforme |

### États gérés partout
- **Chargement** : squelettes à la forme du contenu (pas de spinner plein écran).
- **Vide** : illustration typographique + action principale (« Ajoutez vos 6 premières photos »).
- **Erreur** : message en français, bouton Réessayer, détails techniques masqués ; formulaires : erreurs par champ.
- **Succès** : toast discret ; confettis dorés uniquement pour les jalons (profil publié, premier devis envoyé, premier mariage confirmé).
- **Hors ligne** : bandeau « Connexion perdue », envois de médias mis en pause puis repris (TUS).

---

## 4. Parcours utilisateur

**A. Inscription → profil publié**
1. Inscription (e-mail ou téléphone, ou Google) → code OTP (SMS ou WhatsApp) → compte créé.
2. Onboarding : chaque étape est enregistrée (`vendors.onboarding_step`), on peut quitter et reprendre.
3. Le score de complétude se met à jour en direct, avec des conseils (« Ajoutez une bio de 200 caractères : +15 % »).
4. Étape 6 : aperçu exact de la page publique → **Publier**. La base refuse la publication s'il manque 6 photos, 1 forfait, 1 contact ou 1 catégorie, et l'interface indique précisément quoi compléter.
5. Confettis dorés → tableau de bord.

**B. Demande → mariage confirmé → avis**
1. Un marié envoie une demande depuis la page publique → notification temps réel à toute l'équipe (+ WhatsApp ou e-mail selon les préférences).
2. Statut **Nouveau** → le prestataire répond (réponse rapide ou message) → **En discussion** automatiquement.
3. « Créer un devis » depuis un forfait → PDF → envoyé dans le fil → **Devis envoyé** ; la date passe **en option** dans le calendrier public.
4. Le marié accepte → **Confirmé** ; la date passe **réservée** dans le calendrier public.
5. Après la date du mariage, l'application propose d'envoyer le **lien d'avis** (lien unique valable 60 jours) → avis vérifié → le prestataire répond publiquement.
6. Perdu : motif demandé (budget, date prise, sans réponse…) → la date en option est libérée.

**C. Passage à une offre payante**
1. Une limite est atteinte (ex. 30 photos en Gratuit) → message clair + « Passer à Pro ».
2. Choix de l'offre → Mobile Money (numéro, confirmation sur le téléphone) ou carte.
3. Webhook signé → abonnement actif → facture PDF → nouvelles limites immédiates.

**D. Équipe**
Le propriétaire invite par e-mail ou téléphone avec un rôle → l'invité crée son compte → accès limité par rôle.

---

## 5. Rôles et droits

| Action | viewer | editor | manager | owner | admin plateforme |
|---|:-:|:-:|:-:|:-:|:-:|
| Voir tableau de bord, demandes, calendrier | ✓ | ✓ | ✓ | ✓ | ✓ |
| Modifier vitrine, galerie, tarifs, répondre aux demandes | | ✓ | ✓ | ✓ | ✓ |
| Statistiques détaillées, factures, gérer l'équipe | | | ✓ | ✓ | ✓ |
| Abonnement, supprimer la vitrine | | | | ✓ | ✓ |
| Badges « Vérifié » / « Recommandé », suspendre, modérer | | | | | ✓ |

« Membre d'équipe » = viewer, editor ou manager. Les droits sont appliqués **dans la base** (RLS), pas seulement dans l'interface.

---

## 6. Base de données

### Tables (27)

| Domaine | Tables |
|---|---|
| Comptes | `profiles` (lié à `auth.users`), `vendor_members` (équipe + rôle) |
| Référentiels | `categories` (avec champs spécifiques par métier), `plans` (limites en JSON) |
| Prestataires | `vendors`, `vendor_categories` |
| Médias | `albums`, `media` (photos/vidéos, « à la une », ordre, statut de traitement), `stories`, `story_items` |
| Tarifs | `packages` (USD/CDF, fixe ou « à partir de », inclus/non inclus, mis en avant, masqué), `package_options`, `promotions` (saisonnières ou limitées) |
| Demandes | `inquiries` (5 statuts), `messages`, `quick_replies`, `quotes` (devis PDF) |
| Calendrier | `availability` (réservé / option / bloqué) + vue publique `public_availability` |
| Avis | `reviews` (réponse publique), `review_requests` (lien unique) |
| Audience | `followers`, `analytics_events` (brut), `vendor_stats_daily` (agrégats pour le tableau de bord) |
| Facturation | `subscriptions`, `invoices` |
| Notifications | `notifications` (temps réel), `notification_prefs` (par type et canal) |

### Relations principales

```
auth.users 1─1 profiles 1─n vendor_members n─1 vendors
vendors 1─n vendor_categories n─1 categories
vendors 1─n albums 1─n media          vendors 1─n stories 1─n story_items n─1 media
vendors 1─n packages 1─n package_options      vendors 1─n promotions
vendors 1─n inquiries 1─n messages            inquiries 1─n quotes
vendors 1─n availability (n─1 inquiries)      vendors 1─n reviews (n─1 inquiries)
vendors 1─1 subscriptions n─1 plans           vendors 1─n invoices
vendors 1─n analytics_events → vendor_stats_daily (agrégé chaque nuit)
```

### Règles métier dans la base (triggers)
- Création d'un compte → profil ; création d'une vitrine → propriétaire + offre Gratuite.
- **Publication** refusée sans 6 photos, 1 forfait visible, 1 contact, 1 catégorie.
- **Quotas** de l'offre : nombre de photos/vidéos, stockage total, taille de fichier, nombre de forfaits.
- Statut de demande → **calendrier** (devis envoyé = option, confirmé = réservé, perdu = libéré).
- Nouveau message / nouvelle demande → **notification** à toute l'équipe + compteur de non-lus.
- Avis publié → **note moyenne** recalculée ; le prestataire peut répondre mais pas modifier l'avis.
- Badges « Vérifié » et « Recommandé » : modifiables uniquement par l'administrateur ou le serveur.

---

## 7. Sécurité

- **RLS sur toutes les tables.** Fonctions `has_vendor_role(vendor, rôle_min)` et `is_admin()` (SECURITY DEFINER, `search_path` figé) utilisées par toutes les politiques.
- Contenus publics (vitrine, médias prêts, forfaits visibles, avis publiés) lisibles par tous **uniquement si la vitrine est publiée**.
- **Demandes de devis** créées uniquement par le serveur : captcha (Cloudflare Turnstile) + limitation de débit (5 demandes / heure / IP et / numéro).
- **Statistiques et paiements** écrits uniquement côté serveur (clé service), jamais depuis le navigateur.
- **Uploads** : liste blanche de types MIME (JPEG, PNG, WebP, AVIF, MP4, WebM, MOV) au niveau du bucket et de la table ; 15 Mo par photo ; vidéo selon l'offre (200 à 500 Mo) ; chemin `{vendor_id}/…` vérifié par les politiques Storage ; contrôle du quota **avant** l'envoi (`/api/uploads/sign`) **et** dans la base ; métadonnées EXIF (GPS) supprimées à la compression.
- Bucket **privé** pour devis, factures et pièces jointes (URL signées de courte durée).
- Notes internes du calendrier jamais exposées : le public lit la vue `public_availability`.
- Webhooks de paiement : signature vérifiée, idempotence par `provider_ref`.
- Sessions : cookies httpOnly (`@supabase/ssr`), déconnexion des autres appareils dans Sécurité, 2FA par OTP en option.

---

## 8. Design system de l'espace

- Mêmes tokens que le site public (`assets/eclat.css`) convertis en variables CSS shadcn :
  - **Sombre (défaut)** : fond `#0A0A0B`, surfaces `#17171A` / `#1F1F23`, texte `#F5F0E8`.
  - **Clair** : fond `#F5F0E8`, surfaces `#FFFFFF` / `#EAE2D5`, texte `#17171A`.
  - Or `#D4AF6A` = action principale, focus, sélection. Rose poudré `#E8A2B4` = statuts et notifications (non lus, « Nouveau »). Bordeaux `#6B1E2E` = erreurs et suppression en mode clair.
- Titres en **Bodoni Moda** (cohérent avec le site ; Playfair ou Fraunces possibles), interface en **Manrope**. Échelle plus compacte que le site : titres de page 28–36 px, texte 15–16 px, chiffres KPI en serif.
- Pas de grain, de curseur personnalisé ni de défilement fluide dans l'outil : il doit être rapide. On garde les transitions courtes (150–250 ms), les squelettes et les confettis pour les jalons.
- Contrastes AA vérifiés dans les deux thèmes ; cibles tactiles ≥ 44 px ; navigation clavier complète (Kanban et réorganisation de photos compris).

---

## 9. Points à valider avant l'étape 2

1. **Nom de la marque** : on garde **Éclat** ?
2. **Stack** : Next.js + Supabase comme proposé, avec le **mode démo** sans base tant que vous n'avez pas de projet Supabase ? (L'alternative est de continuer en HTML statique comme le site public : plus rapide à montrer, mais à réécrire ensuite.)
3. **Paiement** : avez-vous déjà un agrégateur Mobile Money (FlexPay, MaxiCash, CinetPay…) ? Sinon je prépare une interface générique à brancher plus tard.
4. **Offres** : Gratuit / Pro 19 USD / Prestige 49 USD par mois avec les limites de `seed.sql` (30 / 300 / 1 500 photos ; 0 / 10 / 50 vidéos ; 0,5 / 5 / 25 Go) ; à ajuster selon votre modèle.

**Suite prévue :** étape 2 (inscription + onboarding) → étape 3 (tableau de bord, vitrine, galerie) → étape 4 (tarifs, demandes, calendrier) → étape 5 (avis, statistiques, abonnement, paramètres), avec validation entre chaque étape.
