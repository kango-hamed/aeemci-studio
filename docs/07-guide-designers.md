# 07 · Préparer un PSD pour en faire un gabarit

Fiche pour l'équipe communication. Un gabarit est un visuel dont certains éléments changent à chaque utilisation (nom, poste, date, photo, montant…). Tout le reste est figé.

## En bref

1. Conçois le visuel normalement, avec un **exemple réaliste** dans chaque élément variable.
2. Tout ce qui n'est pas marqué est **aplati dans le fond, sous les zones**. Un décor qui doit rester **par-dessus** une zone (texture, tache…) se garde **en couche**.
3. Utilise des **polices libres** pour les textes variables.
4. Dans le plugin : **Inspecter**, **marquer** chaque calque variable, **garder en couche** les décors à laisser par-dessus, puis **Générer**.

## Les règles

| Règle | Pourquoi |
|---|---|
| **Un calque par élément variable**, à l'intérieur d'un plan de travail. Ne marque ni le plan de travail ni un groupe. | Le plugin associe un champ du formulaire à un calque. |
| **Décor par-dessus une zone : à garder en couche.** Sélectionne la tache, la texture ou l'empreinte (ex. la tache plume « Calque 14 » de `panel.psd`) et clique **Garder le calque sélectionné en couche**. Elle est exportée à part et reposée par-dessus, dans l'ordre de Photoshop. Les autres calques sont aplatis dans le fond. Modes de fusion reproduits : normal, produit, superposition, lumière tamisée/crue, densité couleur ±, obscurcir, éclaircir, différence, exclusion, teinte, saturation, couleur, luminosité. | Le plugin cite les calques posés sur une zone quand tu la marques ; il prévient si un calque du fond est posé sur une couche (il passerait dessous). |
| **Pas de calque de réglage au-dessus d'une zone** (Courbes, Teinte/Saturation, Grain…). Place-le sous les zones. Évite aussi les modes **densité linéaire**, **lumière vive**, **mélange maximal** sur ces calques. | Un réglage ne s'isole pas en image : son effet ne s'appliquerait pas au contenu variable. Ces modes n'ont pas d'équivalent dans le générateur. |
| **Pas d'effet de calque sur un texte variable** (ombre, dégradé, contour…). Le **faux gras** est accepté. | Ces effets ne sont pas reproduits sur le texte généré. |
| **Polices libres** pour les textes variables : Montserrat, Outfit, Poppins, Amiri… (Google Fonts). Les polices décoratives sont permises dans le **fond**. | Le serveur doit installer la police. Les Adobe Fonts et les polices « Personal Use Only » ne peuvent pas l'être. |
| **Texte horizontal, non déformé.** | Le texte pivoté ou déformé n'est pas encore pris en charge. |
| **Mets dans l'exemple la longueur la plus fréquente**, puis vérifie qu'un texte plus long tient dans la place (le générateur réduit la taille jusqu'à 55 % de l'original). | Le générateur ajuste la taille, mais seulement dans la limite de la place disponible. |
| **Texte court** (nom, titre) : texte de point. **Texte long** (thème, message) : zone de texte (paragraphe). | Le paragraphe passe à la ligne tout seul, dans son cadre. |
| **Photo** : un objet dynamique **écrêté** sur une forme. Pour les coins arrondis, utilise l'outil Rectangle avec un rayon (forme modifiable). | Le cadre de la photo est celui de la forme ; ses coins arrondis sont repris. |
| **Date découpée** (« SAM » / « 15 » / « NOVEMBRE ») : marque chaque calque avec le **même champ** `date` et un format différent (`EEE`, `d`, `MMMM`). Écris l'exemple dans la casse voulue (MAJUSCULES, Majuscule initiale…). | Une seule date saisie remplit tous les morceaux, avec la même casse que ton exemple. |
| **Texte fixe + valeur dans le même calque** (« Collecté : 166 000 f CFA ») : indique un **modèle** `Collecté : {valeur} f CFA`. | Seule la partie variable est demandée dans le formulaire. |
| **Une déclinaison par plan de travail** (post, story…), avec les **mêmes noms de champ**. | Un seul formulaire produit toutes les déclinaisons. |

## Formats de date utiles

| Format | Résultat pour le 15/11/2026 |
|---|---|
| `EEE` | dim (la casse suit ton exemple : « Dim », « DIM ») |
| `EEEE` | dimanche |
| `d` | 15 |
| `dd` | 15 (05 pour le 5) |
| `MMMM` | novembre |
| `MMM` | nov |
| `yyyy` | 2026 |
| `EEEE d MMMM yyyy` | dimanche 15 novembre 2026 |

## Avant d'envoyer un gabarit

- Le plugin n'affiche aucun avertissement, ou chacun a été compris et accepté.
- Les fonds produits (`gabarit/fond-*.png`) ont la taille du plan de travail et ne montrent plus les éléments variables.
