# Atelier — AEEMCI Studio

Écran de **finalisation d'un gabarit** produit par le plugin Photoshop (dossier contenant `manifest.json` 1.1 et `gabarit/`). Application locale : un petit serveur Node et une page.

```bash
npm install && npx playwright install chromium   # une fois, à la racine du dépôt (l'atelier utilise le moteur)
node outils/atelier/src/serveur.ts --dossier "D:\design-conception\aeemci\panel-designhub-3"
# puis ouvrir http://127.0.0.1:4321/
```

Options : `--polices polices.json` (catalogue des polices installées, défaut : les polices installées avec le moteur, `packages/moteur/polices`), `--port 4321`.

## Ce qu'on y fait

- **Nommer le gabarit** et le décrire pour les membres.
- **Pour chaque champ** : libellé (la question posée), aide, obligatoire, nombre maximum de caractères, ordre dans le formulaire (↑ ↓), minimum et maximum d'une jauge.
- **Pour chaque zone** : comportement si le texte est trop long (réduire, couper, refuser), taille minimale, largeur disponible, format de date, modèle `{valeur}`.
- **Aperçu en direct**, rendu par le moteur :
  - *Texte d'exemple* : le contenu du PSD ;
  - *Texte le plus long* : chaque texte prolongé jusqu'à son maximum, date la plus longue, pour vérifier que rien ne déborde ;
  - *Mes valeurs* : le formulaire tel que les membres le verront, avec sa propre photo.
  Sous l'image : ce qui a été réduit, coupé ou déborde encore.
- **Contrôles avant publication** : bloquants (fond ou couche manquant, police non installée, champ sans zone, libellé vide…) et remarques (libellé resté à la valeur d'exemple…). Les avertissements du plugin sont rappelés.
- **Publier** : écrit `gabarit.publie.json` dans le dossier (révision numérotée). Le `manifest.json` du plugin n'est jamais modifié ; l'atelier rouvert repart de la dernière publication.

Le serveur n'écoute que sur `127.0.0.1`. Tests : `cd atelier && npm test` (4 tests : contrôles, valeurs d'essai, API, publication).
