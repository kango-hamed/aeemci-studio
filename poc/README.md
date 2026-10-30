# Preuve de concept gabarit

Voir `docs/05-poc-gabarit.md` pour les résultats.

- `scripts/inspecter.mjs <fichier.psd>` : inventaire JSON (textes, polices, tailles, objets dynamiques), sans données d'image.
- `scripts/extraire.mjs <fichier.psd> <sortie>` : composite PNG + calques texte avec transformation.
- `scripts/rendre.mjs <sortie> <image.png> "calque1|calque2"` : redessine les textes extraits en rouge par-dessus le composite (variable `MASQUE=1` : texte noir seul, pour la mesure).
- `scripts/demo.mjs '[{"nom":"…"}]'` : rendu du gabarit `resultats/gabarit-membre-retenu.json`.

Dépendances : `ag-psd`, `pngjs`, `playwright`, `@fontsource/outfit`, `@fontsource/montserrat`.
`travail/` contient les inventaires et composites intermédiaires.
