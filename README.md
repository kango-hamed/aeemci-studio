# AEEMCI Studio

Générateur de documents de l'AEEMCI (section ESATIC) : visuels et documents administratifs produits à partir de gabarits, via un formulaire. C'est le **premier composant** d'une future plateforme de gestion de l'association (centralisation des documents par délégation, archives et passation des bureaux).

Successeur de `aeemci-plateform` (V1, générateur d'affiches React/Vite + Neon), réécrit en une nouvelle application Next.js. Les gabarits sont créés par l'équipe communication dans Photoshop/Illustrator, en s'appuyant sur le plugin et le contrat de manifest de **MCP DesignHub** (`../design-tools`).

## État

Lots 2 (organisation, rôles, liens d'activation), 3 (documents : brouillon et visibilité, dépôt de fichiers, déclinaisons, recherche), 4 (documents officiels : rédaction, validation, numérotation, signature et cachet), 5 (activités, clôture du mandat, dossiers de passation, archives et recherche plein texte), 6 (écran Gabarits : import du dossier du plugin, réglages avec aperçu, publication, révisions, designers) et 7 (lettres en nombre : invitations et demandes de dons, une lettre numérotée et signée par destinataire depuis un fichier CSV) et 8a (version mobile : application web installable, barre d'onglets, écrans repris pour le téléphone) livrés les 30 et 31/10/2026, après les lots 1a et 1b : **application en ligne de bout en bout** (connexion, import des gabarits publiés par l'atelier, formulaire avec aperçu en direct, documents enregistrés et re-téléchargeables, haute définition, partage sur téléphone). Prochaine étape : mise en ligne (doc 10) et bascule depuis la V1 (lot 1c), puis Illustrator (P2).

Déjà en place avant : moteur de rendu v0.1 (doc 06), atelier local v0.1 (remplacé au lot 6 par l'écran Gabarits, doc 08), plugin DesignHub 0.2 validé dans Photoshop sur `panel.psd` (doc 05).

## Organisation du dépôt

| Dossier | Contenu |
|---|---|
| `apps/web` | L'application AEEMCI Studio (Next.js). Une fonctionnalité par dossier dans `src/fonctionnalites/`. |
| `packages/moteur` | Moteur de rendu : gabarit + valeurs → PNG / PDF (Chromium) ; polices installées (`polices/`) ; contrôles des gabarits. |
| `docs` | Conception, décisions, plan des lots, déploiement. |
| `charte` | Jetons et guide du design system, logos. |
| `poc` | Preuve de concept gabarit (historique). |

Démarrage rapide : `npm install`, puis la section 1 du doc 10.

## Ordre de lecture

| # | Document | Sujet |
|---|---|---|
| 01 | [Vision et périmètre](docs/01-vision-et-perimetre.md) | Les trois piliers, ce que couvre le générateur |
| 02 | [Décisions](docs/02-decisions.md) | Journal des décisions prises et de leurs raisons |
| 03 | [Questions ouvertes](docs/03-questions-ouvertes.md) | Ce qui reste à trancher avant le cahier des charges |
| 04 | [Profil gabarit du manifest](docs/04-profil-gabarit-manifest.md) | Section `gabarit` du manifest DesignHub 1.1 (implémentée dans le plugin 0.2) |
| 05 | [Preuve de concept gabarit](docs/05-poc-gabarit.md) | PSD réels → gabarit → rendu : résultats et ajustements |
| 06 | [Moteur de rendu](docs/06-moteur-de-rendu.md) | Gabarit + valeurs → PNG / PDF (`moteur/`) |
| 07 | [Guide designers](docs/07-guide-designers.md) | Préparer un PSD pour en faire un gabarit (fiche pour l'équipe communication) |
| 08 | [Écran Gabarits](docs/08-atelier.md) | Importer, régler et publier un gabarit : libellés, contraintes, aperçu en direct, révisions |
| 09 | [Plan des lots](docs/09-plan-des-lots.md) | Découpage du développement : lot 1 = nouvelle application + moteur de rendu, puis organisation, documents, administratif, archives |
| 10 | [Installer et déployer](docs/10-deploiement.md) | En local, puis Neon + Google Cloud Run (gratuit) |

Charte graphique : design system « AEEMCI ESATIC » (Claude, lien privé : https://claude.ai/artifact/YT1zcSKt7Ahdywmfdm93x5), copie des jetons et du guide dans `charte/` ; logos extraits des PSD dans `charte/sources/`.

Analyse de la V1 : document « Analyse AEEMCI V1 — base du cahier des charges V2 » (Claude Docs).
