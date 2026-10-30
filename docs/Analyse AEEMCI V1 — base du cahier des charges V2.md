# Analyse AEEMCI V1 — base du cahier des charges V2

Oct 30, 2026 · @Kango

## 1. Synthèse

La plateforme est un générateur d'affiches en libre-service pour les délégations de l'AEEMCI section ESATIC : l'utilisateur choisit un type de contenu, puis un template, remplit un formulaire et télécharge un PNG. Le parcours principal fonctionne de bout en bout. L'outil reste cependant un MVP fragile : l'image générée n'est jamais stockée, la création de templates exige d'écrire du HTML/CSS/JSON à la main, et la migration récente de Supabase vers Neon a supprimé le stockage de fichiers sans le remplacer.

La V2 doit d'abord consolider ces fondations (stockage, moteur de rendu, sécurité, qualité). Les nouvelles fonctionnalités prévues par la roadmap (multi-formats, partage, validation) viennent ensuite. Plusieurs décisions de cadrage restent à prendre avant de rédiger le cahier des charges (section 7).

**Chiffres clés :** \~3 400 lignes (TS/TSX + SQL), 8 commits (janvier → octobre 2026), 0 test, 27 erreurs de lint, 4 tables métier, 1 template d'exemple, 6 types de contenus.

## 2. Ce que fait la V1 aujourd'hui

| Fonctionnalité | État | Remarque |
| --- | --- | --- |
| Inscription email + mot de passe + code OTP | ✅ Fonctionnel | Migré vers Neon Auth le 29/10 ; test réel complet encore à faire |
| Connexion / restauration de session | ✅ Fonctionnel |  |
| Mot de passe oublié | ❌ Absent |  |
| Profil utilisateur (page) | ❌ Absent | Nom et délégation saisis seulement à l'inscription |
| Choix type de contenu → template | ✅ Fonctionnel | Aperçu affiché seulement si `preview_url` a été renseignée à la main |
| Formulaire dynamique | ⚠️ Partiel | text, textarea, date, time, number OK ; `select` est déclaré mais s'affiche comme un champ texte (options ignorées) |
| Champs calculés (formules) | ✅ Fonctionnel | Évalués avec `new Function` (voir risques) |
| Formatage des nombres (`data-format`) | ✅ Fonctionnel | Séparateur de milliers uniquement |
| Validation des champs obligatoires | ❌ Non bloquante | Le bouton « Visualiser » ne valide pas le formulaire |
| Format des dates | ⚠️ Brut | Les dates s'impriment au format `2026-10-30` sur l'affiche |
| Prévisualisation | ⚠️ Partiel | Étape séparée, pas en temps réel ; échelle fixe à 50 %, peu adaptée au mobile |
| Export | ⚠️ PNG seul | Rendu ×2 (2160 px pour un template 1080) ; le JPEG annoncé n'existe pas |
| Historique | ⚠️ Cosmétique | 20 derniers visuels (métadonnées seules), pas de miniature ; le bouton « Télécharger à nouveau » ne fait rien car l'image n'est pas stockée |
| Admin — templates | ⚠️ Rudimentaire | CRUD via trois zones de texte brutes (HTML, CSS, JSON), sans aperçu, sans upload d'assets ; `ordre` toujours à 0, `created_by` toujours vide |
| Admin — types de contenus | ✅ Fonctionnel | Icônes limitées à 6, codées en dur |
| Admin — statistiques | ⚠️ Minimal | 4 compteurs ; `/admin/stats` affiche la même page que le dashboard ; pas de stats par template ni par délégation |
| Gestion des utilisateurs et rôles | ❌ Absent | Promotion admin uniquement par requête SQL manuelle |

## 3. Architecture technique actuelle

- **Frontend :** SPA React 19 + Vite 7 + TypeScript 5.9, Tailwind 3, Zustand (état d'authentification), React Router 6, lucide-react.
- **Backend :** aucun serveur applicatif. Le navigateur parle directement à **Neon** : Postgres + Managed Better Auth + Data API, via `@neondatabase/neon-js` (version bêta) et un adaptateur de compatibilité Supabase.
- **Sécurité des données :** reposent entièrement sur les politiques RLS et les GRANT PostgreSQL (`database/neon-schema.sql`). Ce socle est propre : fonction `is_aeemci_admin()`, colonne `role` non modifiable par l'utilisateur, tables héritées de Better Auth non exposées.
- **Rendu des affiches :** côté client avec `html2canvas`. Le template est du HTML/CSS stocké en base, avec des variables `{{champ}}` remplacées par des expressions régulières puis injectées via `dangerouslySetInnerHTML`.
- **Hébergement :** Vercel ou Netlify (`vercel.json` et `_redirects` présents).
- **Stockage de fichiers :** **aucun** depuis la migration. Les images du template « suivi de progression » pointent encore vers le bucket Supabase de l'ancien projet.

**Modèle de données :** `user_profiles`, `types_contenus`, `templates`, `visuels_generes`. Rien ne couvre aujourd'hui les assets, les versions de templates, les délégations (texte libre), les statuts de validation ou l'audit.

## 4. Constats et dette technique

### Priorité haute

1. **Pas de stockage de fichiers.** Neon n'en fournit pas. Conséquences : pas d'upload d'assets ni d'aperçus, historique non ré-téléchargeable, et un template qui dépend d'un bucket Supabase pouvant disparaître à tout moment.
2. **Injection HTML.** Les valeurs saisies sont insérées sans échappement dans le HTML rendu. Un texte comme `<img src=x onerror=…>` s'exécute. Aujourd'hui l'impact se limite à l'utilisateur lui-même. Il deviendra réel dès que des visuels seront partagés ou relus par d'autres (workflow de validation). Le HTML des templates n'est pas non plus assaini.
3. **Formules évaluées par `new Function`.** Le filtre accepte toutes les lettres, donc n'importe quel identifiant JavaScript. À remplacer par un vrai parseur d'expressions.
4. **Dépendance instable.** `@neondatabase/neon-js` est en `"latest"`, version bêta, avec un contournement de types documenté. Les builds ne sont pas reproductibles et une mise à jour peut tout casser.
5. **Fragilité du rendu html2canvas.** Seules les polices chargées globalement (Poppins, Amiri) sont disponibles ; la prise en charge du CSS est partielle ; les images cross-origin posent problème. La détection des dimensions repose sur des regex dans le CSS, des noms de classes « magiques » et un délai de 500 ms. **À tester en priorité :** le rendu du texte arabe (hadiths), où html2canvas est réputé peu fiable pour la liaison des lettres.

### Priorité moyenne

6. **Qualité :** aucun test, pas de CI, 27 erreurs ESLint (principalement des `any`), 22 `console.log` dans `PosterCreator.tsx`, journalisation html2canvas activée en production.
7. **Composant monolithique :** `PosterCreator.tsx` (646 lignes) mélange chargement, formules, dimensions, rendu, export et UI.
8. **Documentation incohérente :** `aeemci_readme.md` décrit encore Supabase et React 18 ; `SUPABASE_SETUP.md` est obsolète ; le dossier `supabase/` est hérité, `server/` est vide, et `temp-vite/` ainsi que `temp-suivi-p.html` sont versionnés.
9. **Administration :** rôles attribués en SQL. La politique RLS `profile_update_self` exige `role = 'user'`, donc un admin ne peut pas modifier son propre profil.
10. **UX :** erreurs remontées par `alert()` ou seulement dans la console, pas d'états d'erreur visibles, pas de mot de passe oublié.
11. **Organisation :** la liste des délégations est codée en dur dans le formulaire d'inscription et stockée en texte libre.

### Points positifs à conserver

- Le modèle « template HTML + configuration de champs JSON » est simple et extensible.
- Les politiques RLS sont bien pensées et documentées.
- Les champs calculés et le formatage numérique répondent à un vrai besoin (affiche de collecte de fonds).
- La stack est légère et gratuite à héberger.

## 5. Écart entre la vision et le réel

**V1 annoncée comme terminée, mais non livrée en pratique :** historique ré-téléchargeable, upload d'assets, export JPEG, statistiques « templates les plus utilisés », compteur de caractères avec validation en temps réel.

**V2 prévue dans la roadmap :** édition avancée (couleurs, polices), export PDF, partage WhatsApp/Facebook, templates multi-formats (story, post, bannière), bibliothèque d'images, statistiques avancées.

**V3 prévue :** workflow de validation, calendrier éditorial, notifications, publication directe sur les réseaux sociaux, mode hors-ligne (PWA).

Note : `CODEX_HANDOFF.md` indiquait « ne pas créer de V2, ne pas passer à Next.js ». Cette consigne valait pour la migration Neon. Elle doit être explicitement levée ou confirmée dans le cadrage de la V2.

## 6. Pistes pour la V2

Les priorités proposées ci-dessous (MoSCoW) sont à valider.

### A. Fondations — prérequis

- **Must** — Stockage de fichiers (assets, aperçus, visuels générés) : Cloudflare R2, Vercel Blob, Supabase Storage seul ou équivalent ; migrer les assets restés sur l'ancien bucket.
- **Must** — Sécurisation du rendu : échappement des valeurs saisies, assainissement du HTML des templates (DOMPurify), formules via un parseur dédié (`expr-eval`, `mathjs`…).
- **Must** — Version de `neon-js` figée, CI (build + lint + tests), suppression des fichiers temporaires, documentation unique à jour.
- **Should** — Décision sur le moteur de rendu : garder le rendu client (html2canvas ou `html-to-image`/`modern-screenshot`) ou passer à un rendu serveur (Satori/`@vercel/og`, ou Playwright/Chromium headless) pour la fidélité, les polices et le texte arabe. Un rendu serveur implique d'ajouter un backend (fonctions serverless).
- **Should** — Découpage de `PosterCreator` en modules testables (moteur de template, formules, export).

### B. Expérience utilisateur (délégations)

- **Must** — Historique réel : miniature, re-téléchargement, duplication d'un visuel pour le refaire.
- **Must** — Validation du formulaire, dates au format français (« jeudi 30 octobre 2026 »), champ `select` fonctionnel.
- **Should** — Champ image (photo d'un intervenant, logo partenaire) avec recadrage.
- **Should** — Aperçu en temps réel à côté du formulaire, adapté au mobile.
- **Should** — Partage natif depuis le téléphone (Web Share API vers WhatsApp), export JPEG et PDF.
- **Should** — Mot de passe oublié, page profil.
- **Could** — Brouillons, favoris, PWA installable.

### C. Administration et templates

- **Must** — Gestion des utilisateurs et des rôles dans l'interface (fin de la promotion par SQL), et correction de la politique RLS sur le profil admin.
- **Must** — Éditeur de template avec aperçu en direct et jeu de données de test, upload d'assets, génération automatique de l'aperçu.
- **Should** — Constructeur de champs visuel à la place du JSON brut.
- **Should** — Déclinaisons multi-formats d'un même contenu (post 1080×1080, story 1080×1920, bannière).
- **Should** — Statistiques par template, type, délégation et période.
- **Could** — Versionnage des templates, réordonnancement par glisser-déposer, catalogue d'icônes étendu, polices par template.

### D. Collaboration et diffusion (frontière V2/V3)

- **Could** — Workflow de validation (créateur → validateur) pour les communiqués officiels, avec statuts et commentaires.
- **Could** — Calendrier éditorial et notifications.
- **Won't (V2)** — Publication directe via les API des réseaux sociaux : complexe (validation d'app Meta) pour un gain faible par rapport au partage natif.

### E. Option IA (à évaluer)

- **Could** — Aide à la rédaction : reformulation d'une annonce, correction orthographique, suggestion de titre dans la limite de caractères du champ.

## 7. Questions à trancher avant de rédiger le cahier des charges

1. **Périmètre organisationnel :** uniquement la section ESATIC, ou d'autres sections AEEMCI (multi-tenant, charte par section) ? C'est la décision qui impacte le plus le modèle de données.
2. **Stack :** conserver React/Vite + Neon en appel direct depuis le navigateur, ou introduire un backend (serverless ou framework full-stack) ?
3. **Rendu :** client ou serveur ? Quel niveau d'exigence sur le texte arabe ?
4. **Stockage et budget :** l'hébergement doit-il rester à 0 FCFA ? Combien de temps conserver les visuels ?
5. **Auteurs des templates :** la cellule informatique en HTML/CSS, ou des designers sans code (ce qui exige un éditeur visuel, un chantier bien plus lourd) ?
6. **Validation :** un circuit d'approbation est-il obligatoire pour certains types (communiqués du Bureau Exécutif) ?
7. **Volumétrie attendue :** nombre d'utilisateurs, visuels par mois, appareils utilisés (mobile majoritaire ?).
8. **Données personnelles :** quelles informations sur les membres conserver, qui peut les voir ?
9. **Calendrier et équipe :** échéance de la V2, nombre de développeurs, disponibilité d'un designer.

## 8. Plan proposé pour le cahier des charges V2

1. Contexte, problématique et objectifs mesurables (temps de création, nombre de visuels, autonomie des délégations)
2. Périmètre, acteurs et rôles (membre, validateur, admin, super-admin)
3. Existant : renvoi vers ce document
4. Besoins fonctionnels : user stories par acteur, priorisées MoSCoW, avec critères d'acceptation
5. Besoins non fonctionnels : performance du rendu, usage mobile, sécurité, disponibilité, coût d'hébergement, accessibilité, langue (FR/AR)
6. Architecture cible et contraintes techniques (choix de rendu, stockage, backend)
7. Modèle de données cible (assets, délégations, versions de templates, statuts de visuels, audit)
8. Migration depuis la V1 (comptes, templates, assets du bucket Supabase)
9. Découpage en lots et planning
10. Plan de tests et critères de recette
