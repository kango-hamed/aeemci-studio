# 06 · Moteur de rendu (v0.1)

Code : `packages/moteur/` (README détaillé). Date : 30/10/2026.

## Rôle dans l'ensemble

```
Photoshop + plugin DesignHub 0.2  →  manifest 1.1 (gabarit) + fonds PNG
                                          │
formulaire (valeurs saisies)  ──────────►  moteur de rendu  →  PNG / JPEG / PDF  →  document stocké
```

Le moteur est une **bibliothèque Node** sans serveur. Le futur backend l'appellera depuis une tâche du worker. Il ne dépend ni de la base de données ni du stockage : il reçoit un gabarit, des valeurs et un catalogue de polices, et renvoie un fichier et un rapport.

## Choix

- **TypeScript exécuté directement par Node** (≥ 22.18), sans étape de compilation, aligné sur la stack proposée (doc 02).
- **Chromium via Playwright**, SVG pour les zones : un même moteur pour le PNG et le PDF.
- **Mise en page dans le navigateur** : la mesure du texte doit se faire avec le moteur de rendu qui dessine.
- **Rapport par zone** (taille finale, réduit, coupé, déborde encore) : le formulaire pourra prévenir l'utilisateur (« ton titre a été réduit ») avant qu'il ne télécharge.
- **Pas de substitution de police** : une police absente du serveur bloque le rendu avec un message clair.

## Validation

11 tests, dont un **test de fidélité** : le nom d'exemple rendu par le moteur recouvre le texte du PSD d'origine à plus de 90 % (composite de `membre-retenu.psd` en référence), sans recalage. Les autres tests couvrent l'ajustement des textes longs, le paragraphe (réduction, coupe), la date éclatée, la jauge, le PDF, le refus des valeurs invalides et l'absence d'injection HTML.

## Prochaines étapes du moteur

1. Plusieurs polices dans une zone (`plages`) avec un modèle.
2. Mode **document** (lettre, PV, convocation) : charte (en-tête, pied, signature) + texte long sur plusieurs pages A4.
3. Apposition de la **signature et du cachet** au moment de la validation (doc 02).
4. Catalogue de polices de production (polices de la charte AEEMCI, licences vérifiées).
