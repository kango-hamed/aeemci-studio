# 08 · Atelier de finalisation des gabarits (v0.1)

Code : `outils/atelier/` (README). Date : 30/10/2026. Capture : `docs/images/atelier-apercu.png`.

## Place dans la chaîne

```
Photoshop + plugin  →  dossier (manifest 1.1, fonds, couches)  →  ATELIER  →  gabarit.publie.json  →  formulaire des membres → moteur → document
```

Le plugin relève des **faits** (géométrie, styles, ordre des calques). L'atelier ajoute les **choix éditoriaux** que Photoshop ne connaît pas : comment le champ s'appelle pour un membre, ce qui est obligatoire, jusqu'où un texte peut s'allonger, et ce qu'on fait quand il déborde.

## Choix

- **Application locale** (serveur Node sur `127.0.0.1` + une page sans framework) : utilisable dès maintenant par l'équipe communication, sans attendre le backend. Le jour où la plateforme existe, les mêmes appels (`/api/etat`, `/api/apercu`, `/api/controler`, `/api/publier`) deviennent des routes du backend, et la page un écran d'administration.
- **Aperçu rendu par le vrai moteur** (même code que la production), pas une imitation dans le navigateur.
- **Trois jeux d'essai** : exemple du PSD, cas le plus long (au maximum de caractères, date la plus longue), valeurs saisies. Le cas le plus long rend visible ce qui déborde avant qu'un membre ne le découvre.
- **Publication = nouveau fichier, révision numérotée** ; le manifest du plugin reste intact, ce qui garde la trace de ce que Photoshop a produit.

## Format publié (`gabarit.publie.json`)

```json
{
  "format": "aeemci-studio/gabarit-publie",
  "revision": 2,
  "publie_le": "2026-10-30T11:40:00.000Z",
  "nom": "Présentation d'un panéliste",
  "description": "…",
  "source": { "manifest": "manifest.json", "nom_fichier": "panel.psd", "generateur": { "…": "…" } },
  "gabarit": { "version": "1.0", "champs": [ { "nom": "nom_paneliste", "libelle": "Nom du panéliste", "aide": "…" } ], "plans": [ "…" ] }
}
```

L'ordre des `champs` est l'ordre du formulaire.

## Essai sur `panel-designhub-3`

Libellés corrigés (« KATIMOU HALIDOU » → « Nom du panéliste »), aperçu en texte le plus long, formulaire avec photo, publication de la révision 1 : tout fonctionne. Le mode *texte le plus long* montre que, dans cet export antérieur à la correction du conteneur, le nom long sort de la carte. La largeur disponible se corrige dans l'atelier ; un nouvel export du plugin la propose directement.

## Suite

- Intégration dans la plateforme : authentification, gabarits par délégation, droits (doc 01).
- Formulaire des membres et rendu à la demande à partir de `gabarit.publie.json`.

## Importer dans la plateforme

La publication écrit `gabarit.publie.json` dans le dossier du gabarit. Pour le mettre à disposition des membres : AEEMCI Studio → **Créer** → **Importer un gabarit** (compte administrateur) → choisir ce même dossier. L'application refait les contrôles de l'atelier, garde les fichiers utiles (pas le PSD), prépare des fonds réduits et une vignette. Republier puis réimporter sous le même nom crée une nouvelle révision. Procédure complète : doc 10, section 6.
