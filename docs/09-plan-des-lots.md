# 09 · Plan de développement par lots

Date : 30/10/2026. **Plan validé par Kango le 30/10/2026**, puis **révisé le même jour** : la V2 est une nouvelle application Next.js (monolithe modulaire) dont les piliers sont des fonctionnalités. `aeemci-plateform` (V1) reste en service jusqu'à ce que la V2 fasse au moins ce qu'elle fait. Hébergement : Google Cloud Run + Neon, en gratuit (doc 10).

## Principes

- **Chaque lot se livre et sert seul** : à la fin d'un lot, les membres utilisent quelque chose de plus, sans attendre le suivant.
- **Une seule application** (`apps/web`, Next.js, TypeScript) ; chaque pilier est une **fonctionnalité** dans `src/fonctionnalites/` (génération, documents, validation, activités, archives, gabarits, organisation), avec ses écrans, ses actions et ses requêtes. Pas de microservices.
- **On réutilise ce qui est déjà construit** : moteur de rendu (`packages/moteur`), profil de gabarit (manifest 1.1), atelier (`outils/atelier`), plugin DesignHub, charte et maquette. De la V1, on garde les gabarits et les usages, pas le code.
- **Une seule image Docker** (application + Chromium), portable d'un hébergeur à l'autre : Cloud Run gratuit pour démarrer, autre chose si l'association investit.
- **Les écrans suivent la maquette** (Design « Maquette AEEMCI Studio ») et le design system AEEMCI ESATIC.

## Vue d'ensemble

| Lot | Contenu | Ce que les membres y gagnent | Taille | Dépend de |
|---|---|---|---|---|
| **1** | Nouvelle application + moteur de rendu | Des affiches fidèles aux PSD, générées depuis un formulaire, re-téléchargeables | M | — |
| **2** | Organisation : délégations, mandats, rôles, comptes | Chacun voit ce qui concerne sa délégation ; accès donnés par le bureau | M | 1 |
| **3** | Documents : espace par délégation, statuts, dépôt, déclinaisons, téléphone | Plus de documents perdus dans les téléphones ; post et story en une fois | M | 2 |
| **4** | Documents administratifs : PDF A4, numérotation, validation, signature | Lettres, PV, convocations, attestations numérotés et signés par le président | L | 3 |
| **5** | Activités, archives, passation | Bilans, historique des mandats, dossier de passation automatique | M | 3 (4 pour les PDF signés) |
| **6** | Outillage des gabarits dans la plateforme | L'équipe communication publie ses gabarits sans outil local | S | 1 (s'enrichit avec 2) |

Ordre conseillé : 1 → 2 → 3 → 4 → 5, le lot 6 en parallèle dès que le lot 1 est livré. Tailles relatives (S < M < L), sans durée : l'équipe et sa disponibilité ne sont pas encore connues.

---

## Lot 1 · Nouvelle application et moteur de rendu

**Objectif** : AEEMCI Studio est en ligne et génère les affiches avec le moteur, à partir des gabarits publiés depuis Photoshop.

### 1a. Squelette de l'application (fait le 30/10/2026)

- Monorepo npm : `apps/web` (Next.js 16, App Router), `packages/moteur`, `outils/atelier`.
- Charte en jetons Tailwind (clair et sombre), polices Montserrat, Outfit et Amiri embarquées.
- Base Postgres (Neon) avec Drizzle : tables d'authentification, section, délégations, mandats, affectations (un rôle par mandat). Migrations versionnées dans `apps/web/drizzle/`.
- Authentification Better Auth hébergée dans l'application : e-mail et mot de passe, **pas d'inscription libre**, premier administrateur créé par `npm run admin:creer`. Session vérifiée côté serveur dans chaque page et action.
- Écrans : connexion, en-tête (rôle et mandat du membre), accueil.
- Image Docker unique (Next.js autonome + Chromium), intégration continue GitHub Actions (lint, types, tests avec Postgres et Chromium, build, image).
- Guide d'installation et de déploiement Cloud Run + Neon : doc 10.

### 1b. Génération (fait le 30/10/2026)

- Fonctionnalité `generation` : rendu côté serveur par le moteur, dans l'application (`POST /api/apercus` en petite taille sans enregistrement, `POST /api/documents` pour le fichier final), un Chromium partagé par instance, rendus simultanés limités.
- Stockage de fichiers Cloudflare R2 (offre gratuite) en production, dossier local en développement : fonds, couches, photos importées, documents générés. Fichiers privés, servis par l'application après contrôle des droits.
- Tables `gabarit` et `revision_gabarit` ; import du dossier publié par l'atelier depuis l'écran « Importer un gabarit » (administrateurs), avec les contrôles de l'atelier (fichiers, polices, champs). Même nom = nouvelle révision ; un document garde toujours la sienne.
- Mémoire : fonds réduits (1620 px) préparés à l'import pour l'aperçu et le fichier réseaux ; haute définition plafonnée à 3600 px, rendue seule. Pic mesuré 1,4 Go sur le gabarit panéliste : instance Cloud Run de 2 Go.
- Écrans « Choisir un gabarit » et « Créer un document » : formulaire construit à partir des champs du gabarit (texte, date, nombre, image, jauge), photo réduite dans le navigateur avant l'envoi, aperçu en direct (champs vides montrés avec l'exemple du designer, alerte si un texte est réduit ou coupé), aperçu au-dessus du formulaire sur téléphone.
- « Mes documents » : chaque document est stocké (PNG 1080 px) et re-téléchargeable, avec sa miniature ; haute définition à la demande ; bouton « Partager » sur téléphone (WhatsApp…).
- Polices : catalogue installé avec le moteur (`packages/moteur/polices` : Montserrat et Outfit, toutes graisses), refus explicite d'une police absente. Amiri (arabe) à ajouter avec le premier gabarit en arabe.

### 1c. Bascule depuis la V1

- Reprise des gabarits utilisés dans la V1 (refaits comme gabarits Photoshop), comptes des membres actifs créés par l'administrateur.
- Quand la V2 couvre l'usage de la V1 : annonce aux membres, V1 en lecture seule puis arrêtée.

**Critères de réception**

- Un membre se connecte sur l'adresse publique (Cloud Run), choisit « Présentation d'un panéliste », saisit nom, poste et photo, voit l'aperçu se mettre à jour et télécharge un PNG identique au rendu de l'atelier.
- Le document apparaît dans son historique et se re-télécharge.
- Un gabarit publié depuis l'atelier puis importé par un administrateur est disponible sans intervention dans la base.
- Les tests du moteur (fidélité au PSD) tournent dans l'intégration continue.

**Hors lot 1** : délégations et droits fins (lot 2), documents PDF (lot 4).

---

## Lot 2 · Organisation, mandats et accès

**Livré le 30/10/2026** (sauf gabarits par délégation et tableau de bord, reportés). Écran « Organisation » réservé au bureau : membres et rôles du mandat en cours, liens d'activation et de réinitialisation à partager (WhatsApp), délégations ; page `/activer/<lien>` ; documents rattachés à la délégation de l'auteur et lisibles par elle ; page « Documents » avec ceux de la délégation (ou de toute la section pour le bureau). Décisions : doc 02.

- Modèle : section → délégations → mandats → membres avec **un rôle par mandat** (président, secrétaire général, responsable de délégation, membre).
- Comptes créés par le bureau (invitation par e-mail) ; l'inscription libre est déjà fermée (lot 1a). Un membre qui n'a plus de rôle au nouveau mandat perd l'écriture automatiquement.
- Droits par délégation et par rôle, vérifiés côté serveur dans la couche d'accès aux données (`fonctionnalites/*/requetes.ts`) ; gabarits utilisables par délégation.
- Écrans : accueil (tableau de bord), gestion des membres et des rôles par le bureau, réinitialisation du mot de passe par e-mail.
- Réception : un membre de la délégation culturelle ne voit pas les documents privés de la cellule communication ; le président voit tout.

## Lot 3 · Documents et centralisation

- Objet **Document** : fichier, gabarit et révision, valeurs saisies, auteur, délégation, mandat, activité, statut (brouillon, publié), visibilité (délégation, bureau, public).
- Espace **Documents de la délégation** : filtres, recherche, dépôt de fichiers existants (PDF, images, scans).
- **Déclinaisons** : un formulaire produit post et story (plusieurs plans du gabarit).
- **Téléphone** : création en mobile, prise de photo, partage direct (WhatsApp).
- Écrans : choisir un gabarit, créer (ordinateur et téléphone), documents de la délégation.

## Lot 4 · Documents administratifs et validation

- **Mode document** du moteur : PDF A4 multipage à partir de la charte (en-tête officiel, pied, texte long), pour lettre, procès-verbal, convocation, communiqué, attestation.
- **Numérotation** `AEEMCI-ESATIC/{délégation}/{type}/{année}/{n°}`, attribuée à la validation, sans trou.
- **Circuit de validation** : envoi au président, validation ou demande de correction avec commentaire, intérim (vice-président). Notifications.
- **Signature et cachet** : images importées par le président, stockées en privé, apposées par le serveur à la validation ; PDF signé figé, toute correction crée une nouvelle version.
- Écran : validation et signature.
- Points à confirmer avant le lot : documents à signature, cachet ou les deux ; signataires multiples d'un PV ; remise à zéro de la numérotation (année ou mandat).

## Lot 5 · Activités, archives et passation

- **Activités** : fiche (date, lieu, délégations), documents rattachés, photos, bilan.
- **Mandats** : clôture (documents en lecture seule, droits transmis), **dossier de passation** généré par délégation (activités, bilans, documents clés, points en suspens).
- **Archives** : mandats précédents, recherche plein texte tous mandats (Postgres), import des anciens dossiers.
- Écrans : fiche d'activité, archives et passation.

## Lot 6 · Outillage des gabarits dans la plateforme

- L'atelier devient l'écran **Gabarits** de la plateforme (administration) : import direct du dossier produit par le plugin, réglages, aperçu, publication, révisions.
- Contrôles à l'import : polices non installées, libellés d'exemple, couches.
- Ensuite : Illustrator par export SVG, puis le plugin Illustrator de DesignHub (P2).

---

## Décisions à prendre, par lot

| Lot | Décision |
|---|---|
| 1 | ~~Hébergement~~ (Cloud Run 2 Go + Neon + R2, gratuit) ; date de bascule depuis la V1 (1c) ; largeur d'impression souhaitée (3600 px par défaut) |
| 2 | ~~Délégations~~ (gérées dans l'application) ; ~~qui crée les comptes~~ (bureau exécutif, lien à partager) ; gabarits réservés à certaines délégations ou non |
| 4 | Signature et cachet par type de document ; signataires des PV ; remise à zéro de la numérotation |
| 5 | Durée de conservation des documents ; données des membres conservées après leur départ |
