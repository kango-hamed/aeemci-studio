# 05 · Preuve de concept : PSD → gabarit → rendu

Date : 30/10/2026. Scripts : `poc/scripts/`. Résultats : `poc/resultats/`.

## Ce qui a été testé

1. **Inspection** de 5 PSD réels de `D:\design-conception\aeemci` avec la bibliothèque `ag-psd` (Node), sans Photoshop.
2. **Fidélité** : les textes sont redessinés par Chromium (SVG) à partir des seules données extraites, puis comparés au composite du PSD par recouvrement de pixels (IoU, décalage).
3. **Gabarit complet** sur `ago/membre-retenu.psd` : manifest 1.1 (`resultats/gabarit-membre-retenu.json`), fond sans le calque du nom, rendu avec un nom court puis un nom très long (`resultats/comparaison.png`).

| Fichier | Taille | Calques | Inspection | Remarque |
|---|---|---|---|---|
| ago/j-y-serai.psd | 37 Mo | 67 | 0,9 s | 1080×1350, faux gras |
| ago/membre-retenu.psd | 38 Mo | 68 | 0,9 s | déjà pensé comme un gabarit (« Nom et prénom ») |
| ago/decompte.psd | 34 Mo | 61 | 1 s | « Jour j - 02 » : valeur calculée |
| ramadan/progression.psd | 424 Mo | 108 | 3,9 s (490 Mo de RAM) | 6400×7200, jauge de progression |
| marhaba/psd/annonce.psd | 124 Mo | 16 | 1,4 s | plan de travail 5400×7200 |

## Résultats

**L'extraction est fiable et rapide.** Pour chaque calque de texte, on obtient le contenu, le type (point ou paragraphe), la police par plage de style, la taille réelle (taille × échelle de la transformation), l'interlignage, l'approche, la couleur, l'alignement, le faux gras et les effets.

**Le rendu reproduit la typographie de Photoshop** une fois trois règles appliquées :

| Texte | Recouvrement (IoU) | Écart résiduel |
|---|---|---|
| « Nom et prénom » (Outfit, centré, approche 100) | 0,95 | 0 px |
| « Membre retenu » (Outfit Black) | 0,88 | 3 px vertical |
| « J'y serai » (Montserrat Bold, faux gras) | 0,92 | 1 px |
| « Ensemble, faisons le bilan… » (paragraphe centré) | 0,76* | 1 px |

\* texte fin : l'anticrénelage pénalise la mesure ; visuellement identique.

Règles établies :

1. **Texte de point : ancrer sur la ligne de base**, pas sur un cadre. La transformation du calque donne le point d'ancrage (`tx`, `ty`) : abscisse selon l'alignement, ordonnée = ligne de base.
2. **Approche** : `approche / 1000 × taille`. Pour un texte centré, décaler l'ancre d'une approche entière (Photoshop centre sans l'espacement final).
3. **Faux gras** : Photoshop l'utilise souvent (`fauxBold`). Émulation calibrée : contour de la couleur du texte de 3 % de la taille, plus 3 % d'approche.
4. **Texte de paragraphe** : première ligne de base = haut du cadre + hauteur réelle des capitales (`actualBoundingBoxAscent`).

**L'ajustement automatique fonctionne** : « Aïcha Kouadio Bintou Ben Abdallah Traoré » passe de 62,5 à environ 40 px et reste dans la largeur prévue.

## Ce qui coince, et ce que ça change

| Constat | Conséquence |
|---|---|
| Le **fond sans les calques dynamiques** ne peut pas être produit fidèlement hors Photoshop (effets, modes de fusion). Pour la démo, le texte a été effacé par retouche automatique (léger flou visible). | Confirme que l'**export du fond revient au plugin** : masquer les calques marqués puis exporter, c'est natif dans Photoshop. |
| Les calques sont nommés par leur contenu (« Rakistaba Adama », « Calque 5 »), jamais par leur rôle. | Une convention de nommage ne suffit pas : il faut le **marquage dans le panneau du plugin**. |
| Une date est souvent **éclatée en plusieurs calques** (« Sam » / « 15 » / « Novembre »). | Un champ peut alimenter plusieurs zones, chacune avec **son propre format** (`EEE`, `d`, `MMMM`). |
| Un calque mélange texte fixe et valeur (« Collecté : 166 000 f CFA ») et **plusieurs polices** dans une ligne (« 6 000 f CFA »). | Une zone doit accepter un **modèle de texte** (`Collecté : {collecte} f CFA`) qui conserve les plages de style. |
| La barre de progression est une **forme**, pas du texte. | Nouveau type de zone : **jauge** (largeur proportionnelle à une valeur). |
| « Jour j - 02 » se calcule à partir de la date de l'activité. | Les **champs calculés** de la V1 restent utiles (avec un parseur sûr). |
| La photo est découpée par un **masque d'écrêtage** : le cadre visible n'est pas le cadre du calque. | Le plugin doit lire le cadre du **calque de base de l'écrêtage**. |
| Polices : Outfit et Montserrat sont libres, mais aussi MasterOfBreak, AGAIslamicPhrases, Glitz et **RegularBrush « Personal Use Only »**. | Les polices de **chaque zone dynamique** doivent être installables sur le serveur et sous licence compatible. Les polices du fond n'ont pas d'importance (elles sont aplaties). |
| Certains fichiers sont en **résolution d'impression** (5400×7200, 6400×7200). | Le gabarit garde la résolution source ; le rendu produit plusieurs tailles (réseaux sociaux, impression). |
| Les fichiers d'une même série (AGO : j-y-serai, membre-retenu, decompte) partagent 90 % du design. | Notion de **série de gabarits** : un même fond de charte, des zones différentes. |

## Conclusion

L'approche **« fond aplati + zones dynamiques en SVG »** est validée sur des fichiers réels : la typographie de Photoshop est reproduite à quelques pixels près, et l'ajustement des textes longs fonctionne. Le risque principal se déplace vers l'**ergonomie du marquage** dans le plugin et vers la **discipline des polices**.

## Suites proposées

1. Mettre à jour le profil gabarit (doc 04) : ancre de ligne de base, faux gras, modèle de texte avec plages de style, champ vers plusieurs zones avec format, type jauge, cadre d'écrêtage.
2. Étendre le plugin DesignHub : panneau de marquage, export du fond, lecture des écrêtages. À tester sur un poste avec Photoshop.
3. Refaire ce test sur un PSD contenant du **texte arabe** et sur une **déclinaison story**.

## Premier essai dans Photoshop (30/10/2026, `panel.psd`, plugin 0.2)

Fichier : `D:\design-conception\aeemci\panel-designhub` (2 plans de travail, 13 534 × 6 414 px, 300 ppp). Zones marquées : nom, poste, photo. Comparaison : `poc/resultats/essai-photoshop-panel.png`.

**Validé dans Photoshop :**

- L'ancre (`TextItem.position`) correspond exactement au centre du texte et à sa ligne de base ; la taille se convertit bien en px (32 pt × 300 / 72 = 133,3 px).
- Le rendu du moteur place nom et poste **sans aucun décalage** par rapport à l'export Photoshop (meilleur recalage : 0 px, 0 px).
- Les calques marqués sont bien masqués sur le fond ; le cadre de la photo vient du masque d'écrêtage.

**Corrigé après l'essai (plugin, non encore re-testé dans Photoshop) :**

| Constat | Correction |
|---|---|
| Fond et export JPEG à 15 582 × 9 486 px, deux plans visibles : dans un document à plans de travail, l'aplatissement étend la zone de travail à tout le contenu. **Défaut présent aussi dans l'export DesignHub existant.** | Nouvelle méthode : sélection du rectangle du plan, « Copier avec fusion », collage dans un document à la taille du plan. |
| La photo était découpée en rectangle alors que le cadre est arrondi. | Rayons du rectangle arrondi relevés sur la forme d'écrêtage (`image.rayons`) ; découpe arrondie dans le moteur. Avertissement si la forme n'est pas un rectangle dynamique. |
| Plage de style répétée (fausse alerte « plusieurs polices »), retour à la ligne final dans l'exemple. | Plages dédoublonnées, texte nettoyé. |
| Champ image nommé d'après le fichier (« confident_professional_in_pink_blazer »). | Proposition par défaut : `photo` / « Photo ». |

**Calques posés au-dessus des zones.** Dans `panel.psd`, « Calque 14 » est une tache plume semi-transparente, voulue, posée au-dessus du plan. Solution retenue : **couches choisies par le designer** (doc 02). Le calque gardé en couche est exporté à part en PNG transparent ; le moteur empile zones et couches dans l'ordre de la pile, avec le mode de fusion.

## Deuxième essai dans Photoshop (30/10/2026, `panel-designhub-3`, plugin 0.2 corrigé)

Zones : nom, poste, photo. Couche choisie : « Calque 14 » (tache plume). Comparaison : `poc/resultats/essai-photoshop-panel-3.png`.

| Contrôle | Résultat |
|---|---|
| Taille du fond et de l'export JPEG | **5 400 × 6 414 px** : la correction par « Copier avec fusion » fonctionne, y compris pour l'export DesignHub |
| Couche transparente | PNG RVBA ; seule la tache (opacité jusqu'à 25 %) ; repères de coin à 1 % (alpha 3) : le fond du plan de travail rendu transparent fonctionne |
| Coins arrondis | rayon lu sur la forme d'écrêtage : 278 px |
| Fond + couche vs export Photoshop, hors zones | écart moyen **0,7 niveau** sur 255 (99 % des pixels à moins de 4) |
| Nom et poste vs export | recouvrement **96 %** et **97 %** ; la tache teinte le début du nom comme dans l'original |

**Corrigé après cet essai :**

- **Liseré blanc du cadre photo**, recouvert par la photo. Le plugin lit l'effet « Contour » de la forme d'écrêtage (`image.contour`) et le moteur le redessine par-dessus la photo (contour intérieur ou centré ; un contour extérieur reste visible sur le fond).
- **Nom long qui débordait de la carte.** La largeur disponible d'un texte de point est bornée par son **conteneur**, la plus petite forme posée sous le texte qui le contient (ici la carte verte « Rectangle 7 »).

Vérifié en rendu en reportant ces deux valeurs à la main dans le manifest (liseré de 25 px mesuré sur le fond). Reste à reproduire par un nouvel export du plugin.
