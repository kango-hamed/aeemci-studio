# 08 · Écran Gabarits (ancien atelier)

Lot 6, 31/10/2026. Code : `apps/web/src/fonctionnalites/gabarits/`. Remplace l'atelier local (`outils/atelier`, v0.1 du 30/10), retiré.

## Place dans la chaîne

```
Photoshop + plugin  →  dossier (manifest 1.1, fonds, couches)  →  ÉCRAN GABARITS  →  révision publiée  →  formulaire des membres → moteur → document
```

Le plugin relève des **faits** (géométrie, styles, ordre des calques). L'écran ajoute les **choix éditoriaux** que Photoshop ne connaît pas : comment le champ s'appelle pour un membre, l'aide affichée, ce qui est obligatoire, jusqu'où un texte peut s'allonger, et ce qu'on fait quand il déborde.

## Qui

Les administrateurs et les **designers** : le bureau marque un membre « designer » dans Organisation (cellule communication), quel que soit son rôle. Comme tout rôle, la marque vaut pour le mandat en cours.

## Parcours

1. **Créer → Gérer les gabarits → Importer un dossier** : choisir le dossier produit par le plugin (le PSD et les exports ne partent pas ; 30 Mo au plus). Pour une nouvelle version, choisir le gabarit concerné (ou garder le même nom de PSD).
2. L'import crée un **brouillon**. Seuls les fichiers manquants et les polices non installées l'empêchent ; le reste se corrige dans l'écran. Pour un gabarit existant, les réglages de la version précédente sont repris pour les champs et zones qui existent encore (même nom de champ et même type ; zones repérées par déclinaison, champ et rang).
3. **Réglages** : libellé, aide, obligatoire, nombre de caractères, bornes d'une jauge, ordre du formulaire ; pour chaque zone de texte, comportement si le texte est trop long (réduire jusqu'à un pourcentage, couper avec « … », refuser la saisie), largeur disponible, format de date, texte fixe autour de la valeur.
4. **Aperçu** rendu par le vrai moteur au fil de la saisie, avec trois jeux d'essai : exemple du PSD, texte le plus long (au maximum de caractères, date la plus longue), valeurs saisies. Le rapport signale les textes réduits, coupés ou qui dépassent.
5. **Publier** : contrôles complets (doc 06), numéro de révision suivant, vignette. Les membres utilisent la nouvelle révision aussitôt ; chaque document garde la sienne et se refait à l'identique.

Ensuite :

- **Modifier les réglages** : nouveau brouillon copié de la révision en service, sans repasser par Photoshop ;
- **Abandonner le brouillon** : la révision en service reste ; un gabarit jamais publié est supprimé ;
- **Remettre en service** une révision plus ancienne ;
- **Fiche** : nom, description, proposé ou non aux membres, réservé à certaines délégations. Un gabarit réservé sert à leurs membres, au bureau exécutif et aux designers.

## Ce que l'écran ne modifie jamais

La géométrie, les styles, les fichiers et la liste des champs viennent du plugin. Le serveur n'accepte que les réglages éditoriaux, en les recopiant sur le contenu enregistré (`reglages.ts`). Pour changer une zone ou un calque : Photoshop, puis nouvelle version.

## Compatibilité

Un dossier qui contient encore un `gabarit.publie.json` de l'ancien atelier s'importe avec les réglages qu'il porte.
