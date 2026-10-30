# Moteur de rendu — AEEMCI Studio

Rend un gabarit (manifest DesignHub **1.1**, section `gabarit`) avec les valeurs saisies dans le formulaire : **PNG, JPEG ou PDF**, une sortie par plan de travail (déclinaison).

```
fond du plan (PNG, calques variables masqués)  +  zones (texte, date, nombre, image, jauge)  →  Chromium  →  fichier
```

## Utilisation

```bash
npm install
npx playwright install chromium        # une fois, si Chromium n'est pas déjà présent
npm test                               # 11 tests, dont la fidélité au PSD d'origine
node src/cli.ts --gabarit exemples/membre-retenu/manifest.json \
                --valeurs exemples/membre-retenu/valeurs.json \
                --polices exemples/polices/polices.json --sortie sortie
```

Options : `--format png|jpeg|pdf`, `--largeur 1080` (réduit un fichier d'impression pour les réseaux), `--plan "<nom>"` (une seule déclinaison).

TypeScript exécuté directement par Node (≥ 22.18, suppression des types), sans étape de compilation.

Depuis du code :

```ts
import { CataloguePolices, rendrePlan } from "./src/index.ts";
const r = await rendrePlan({ gabarit, dossier, valeurs, polices: CataloguePolices.depuisFichier("polices.json") });
// r.fichier (Buffer), r.rapport : par zone, taille finale, réduit / coupé / déborde encore
```

## Ce que fait le moteur

| Zone | Comportement |
|---|---|
| Texte de point | posé sur sa **ligne de base** ; si trop long : **réduire** (jusqu'à `taille_min_px`), **couper** (« … ») ou **refuser** (erreur de validation) |
| Paragraphe (`box`) | retour à la ligne dans le cadre, interlignage proportionnel ; réduction si trop haut, ou coupe |
| Date | format par zone (`EEE`, `d`, `MMMM`…) en français ; **casse calquée sur l'exemple** du designer (« Sam », « NOVEMBRE ») |
| Nombre | espaces des milliers (`3 047 900`), virgule décimale ; `modele` : `Collecté : {valeur} f CFA` |
| Image | recadrée dans le cadre de l'écrêtage (`couvrir` ou `contenir`) |
| Jauge | barre proportionnelle à la valeur entre `min` et `max` |
| Couche | calque du PSD qui recouvre une zone (texture, tache…), PNG transparent posé **dans l'ordre de la pile** avec les zones, avec son mode de fusion (`multiply`, `screen`, `overlay`…) |

Règles calibrées sur des PSD réels (`../docs/05-poc-gabarit.md`) : décalage d'une approche pour les textes centrés ou à droite, **faux gras** émulé (contour + approche de 3 %), première ligne de base d'un paragraphe à la hauteur des capitales.

**Sécurité :** le texte saisi est posé avec `textContent` (jamais interprété comme du HTML) ; les fichiers sont servis par une origine fictive interceptée, sans accès réseau.

**Polices :** chaque zone désigne sa police par son nom PostScript ; `polices.json` dit quel fichier l'implémente sur le serveur. Une police absente **bloque** le rendu (pas de substitution silencieuse).

## Limites connues (v0.1)

- Plusieurs polices dans une même zone (`plages`) : la première police s'applique à tout le texte.
- Texte pivoté ou déformé, effets de calque sur le texte variable : non reproduits (le plugin le signale).
- Modes de fusion sans équivalent dans le navigateur (densité linéaire, lumière vive…) : rendus en mode normal (le plugin le signale).
- Pas encore de documents multipages (lettres, PV) : ce sera un second mode, fondé sur la charte et une mise en page HTML.

## Fichiers

- `src/valeurs.ts` : validation et formats français (sans navigateur).
- `src/mise-en-page.ts` : mise en page exécutée dans Chromium (mesure, ajustement, lignes).
- `src/rendu.ts` : orchestration Playwright, PNG/JPEG/PDF. `src/cli.ts` : ligne de commande.
- `exemples/` : `membre-retenu` (gabarit issu d'un vrai PSD AEEMCI, photo de test), `collecte` (synthétique : date éclatée, nombre avec modèle, jauge, paragraphe), `polices/` (Outfit, Montserrat, OFL).
- `test/fixtures/original-membre-retenu.png` : composite du PSD d'origine, référence de fidélité.
