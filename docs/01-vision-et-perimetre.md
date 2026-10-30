# 01 · Vision et périmètre

## Problème

Les documents de l'association (administration, annonces, événements) sont dispersés, se perdent au changement de bureau, et leur accès n'est pas contrôlé. Les visuels récurrents mobilisent l'équipe communication pour des tâches répétitives.

## Vision : trois piliers

1. **Génération de documents** à partir de gabarits, via un formulaire, par les membres du bureau.
2. **Centralisation des documents par délégation**, accessibles en ligne selon les droits.
3. **Archives** : historique des activités organisées et passation entre bureaux.

Objectifs : réduire la perte d'information et de documents, améliorer l'accès et le contrôle des autorisations.

## Périmètre de cette version : le générateur

On construit d'abord le pilier 1, **conçu comme un composant de l'ensemble** :

- chaque document généré est un objet de la plateforme (fichier, gabarit et version, données saisies, auteur, délégation, mandat, activité facultative), pas un simple téléchargement ;
- les droits s'appuient sur la délégation et le **mandat** (rôle lié au mandat, pas à la personne).

### Deux familles de documents

| Famille | Exemples | Sortie | Origine du gabarit |
|---|---|---|---|
| Visuels | affiche, story, bannière, rappel, hadith | PNG / JPEG | Import depuis Photoshop (puis Illustrator) |
| Documents administratifs | lettre, PV, convocation, communiqué, attestation, ordre de mission | PDF, multipage A4 | Charte (en-tête, pied, signature) + mise en page à texte long |

### Hors périmètre de cette version

Centralisation complète, archives et passation, cotisations, trésorerie, annuaire des membres.
