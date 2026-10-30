# 04 · Profil gabarit du manifest

Statut : **implémenté dans le plugin DesignHub 0.2** (`../design-tools`), testé hors de Photoshop, **reste à valider dans Photoshop**. Il a été révisé d'après la preuve de concept (doc 05).

Référence normative : `design-tools/config/manifest.schema.json` → propriété `gabarit` et définitions `$defs.gabarit`, `$defs.zone_gabarit`, `$defs.cadre`.

## Principe

- Le manifest DesignHub passe en **1.1** quand il contient une section `gabarit`. L'ajout est compatible : DesignHub conserve la section sans l'utiliser.
- **Tout calque non marqué est aplati dans le fond** (un PNG par plan de travail, calques marqués masqués). Seuls les **calques marqués** deviennent des **zones dynamiques**.
- Chaque **plan de travail** est une **déclinaison** du même gabarit : un seul formulaire produit toutes les déclinaisons.
- Le manifest décrit **des faits** (géométrie, style). Les **règles de rendu** (correction de l'approche, émulation du faux gras…) appartiennent au générateur (doc 05).

## Structure

```json
"gabarit": {
  "version": "1.0",
  "champs": [
    { "nom": "nom", "type": "texte", "libelle": "Nom et prénom du membre", "obligatoire": true, "max_caracteres": 40, "provenance": "designer" },
    { "nom": "photo", "type": "image", "libelle": "Photo du membre", "obligatoire": true, "provenance": "designer" }
  ],
  "plans": [
    {
      "plan": "membre-retenu", "largeur_px": 1080, "hauteur_px": 1350, "fond": "gabarit/fond-membre-retenu.png",
      "zones": [
        {
          "champ": "nom", "calque": "Nom et prénom", "forme": "point",
          "ancre": { "x": 535.75, "ligne_de_base": 1127.91 }, "largeur_max": 798.4,
          "texte": { "nom_postscript": "Outfit-Regular", "famille": "Outfit", "taille_px": 62.52, "approche_em": 0.1, "faux_gras": false, "couleur": "#2D2D2D", "alignement": "centre" },
          "debordement": { "mode": "reduire", "taille_min_px": 34.39 },
          "exemple": "Nom et prénom", "provenance": "plugin"
        },
        {
          "champ": "photo", "calque": "WhatsApp Image…",
          "cadre": { "x": 337, "y": 606, "largeur": 407, "hauteur": 396 },
          "image": { "ajustement": "couvrir", "ecretage": "Rectangle 1" }, "provenance": "plugin"
        }
      ]
    }
  ]
}
```

### Types de champ

| Type | Zone | Particularités |
|---|---|---|
| `texte` | texte de point (`ancre` + `largeur_max`) ou de paragraphe (`cadre`) | `debordement` : `reduire` (jusqu'à `taille_min_px`), `couper`, `refuser` ; `modele` facultatif |
| `nombre` | idem texte | `modele` pour le texte fixe : `Collecté : {valeur} f CFA` |
| `date` | idem texte | un même champ peut alimenter plusieurs zones, chacune avec son `format` (`EEE`, `d`, `MMMM`) |
| `image` | `cadre` = cadre du **masque d'écrêtage** s'il existe | `ajustement` : `couvrir` / `contenir` |
| `jauge` | `cadre` de la forme | `min`, `max` ; largeur proportionnelle à la valeur |

### Texte

- **Texte de point :** `ancre.x` (selon l'alignement) et `ancre.ligne_de_base`. Pas de cadre : la largeur disponible `largeur_max` est calculée selon l'alignement (marges de 5 %), modifiable dans le générateur.
- **Texte de paragraphe :** `cadre`. La première ligne de base est placée par le générateur.
- `approche_em` = approche Photoshop / 1000 ; `faux_gras` à émuler ; `plages` quand plusieurs polices coexistent dans le calque.

## Avertissements produits par le plugin

Police absente du poste, texte pivoté ou déformé, effets de calque sur un texte variable, plusieurs polices sans modèle, zone hors du plan, image sans écrêtage, calque introuvable, champ sans zone.

## Encore ouvert

- Polices des zones : vérification de licence (aujourd'hui seulement « présente sur le poste »).
- Calques pivotés et textes déformés : non pris en charge.
- Illustrator : export SVG en attendant le plugin (P2 de DesignHub).
- Le libellé, l'aide et l'ordre des champs pourront être retouchés dans l'écran de finalisation du générateur.
