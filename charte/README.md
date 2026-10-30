Système graphique de la section **AEEMCI ESATIC** (Association des Élèves et Étudiants Musulmans de Côte d'Ivoire, section de l'ESATIC). Il sert aux écrans de la plateforme (AEEMCI Studio : génération de documents, espace des délégations, archives) et aux documents qu'elle produit. Il reprend l'identité déjà portée par les affiches de la section : le croissant orange, le vert ESATIC, le crème des spirales.

## Ton et rédaction

- **Fraternel et respectueux.** Tutoiement collectif et appel à se rassembler, comme sur les affiches : « Viens le découvrir avec nous. », « Ensemble, faisons le bilan et ouvrons la voie à la relève. » Dans l'interface, s'adresser au membre en « tu » ; dans un document officiel (lettre, procès-verbal, communiqué), « vous » et formules administratives.
- **La devise s'écrit telle quelle** : « AEEMCI, pour une identité islamique ! » (virgule, point d'exclamation, espace insécable avant « ! »).
- **Formules religieuses** : écrire « le Prophète (SAW) » ; une citation en arabe s'accompagne de sa traduction et de sa référence (« Rapporté par Al-Bukhari »).
- **Casse** : majuscules réservées aux surtitres en `etiquette` (« VIENS LE DÉCOUVRIR AVEC NOUS. », « SAMEDI 10 OCTOBRE 2026 » sur une affiche) et au sigle AEEMCI. Titres et boutons en casse de phrase (« Publier le gabarit », pas « Publier Le Gabarit »).
- **Dates et heures à la française** : « samedi 10 octobre 2026 », « à partir de 14 h », montants « 3 047 900 F CFA ».
- **Pas d'emoji** dans l'interface ni dans les documents officiels.
- Nommer les choses comme les membres les connaissent : *délégation*, *bureau*, *mandat*, *activité*, *document* ; pas *tenant*, *template* ni *asset*.

## Logos

| Fichier | Quand |
|---|---|
| `aeemci-esatic-croissant.png` | Logo de la **section** : en-tête de l'application, affiches, réseaux sociaux. Logo principal de la plateforme. |
| `aeemci-sceau.png` | Sceau **national** de l'AEEMCI : documents officiels (lettres, procès-verbaux, attestations), en haut à gauche de l'en-tête. |
| `aeemci-50-ans.png` | Logo du **cinquantenaire** (1975-2025) : communications de l'année du jubilé seulement. |

- **En-tête officiel** : sceau à gauche, croissant AEEMCI ESATIC à droite, au centre en `titre` sur cinq lignes : « AEEMCI », « Association des Élèves et Étudiants Musulmans de Côte d'Ivoire », « Secrétariat Régional Abidjan Sud », « Sous Comité Treichville », « Section ESATIC ».
- Ne jamais redessiner, recolorer, étirer ni détourer un logo. Sur fond sombre ou photo, poser le logo sur une pastille `surface-relevee` en `rayon-m`, comme sur les affiches.
- Zone de protection : au moins la hauteur du mot ESATIC autour du croissant.

## Couleurs

- Fond de page `surface`, cartes et champs `surface-relevee`, texte `encre`, texte secondaire `encre-douce`.
- **`vert-esatic` porte la marque** : bouton principal (texte `sur-vert`), liens, onglet actif, titres de section. Un seul bouton principal par écran.
- **`orange-croissant` est l'accent** : jauges, pastilles, filet sous un titre, motif du croissant. Jamais en texte sur fond clair ; un texte posé dessus prend `sur-orange`. Pour un texte orangé, utiliser `orange-texte`.
- `vert-affiche` pour les grands titres éditoriaux (`affiche`), comme « Membre retenu » sur les affiches.
- `vert-profond` pour les bandeaux pleins (en-tête de l'application, pied de document) avec `sur-vert-profond`.
- `or` seulement sur un vert (`vert-esatic`, `vert-profond`), en grand ou en gras : c'est le poste du panéliste sous son nom.
- `creme` pour adoucir : encadré mis en avant, bandeau d'annonce, fond d'avertissement.
- États : `succes` sur `fond-succes`, `attention` sur `fond-attention`, `danger` sur `fond-danger`. Toujours accompagnés d'un mot ou d'une icône.
- Proportions sur un écran : beaucoup de `surface`, du `vert-esatic` pour structurer, une touche d'`orange-croissant`. Jamais l'orange en grande surface d'interface.

## Typographie

- **Montserrat** (`titre`) : les titres, les étiquettes, le nom des choses. C'est la police des affiches de la section et la plus proche du mot AEEMCI du logo.
- **Outfit** (`texte`) : le texte courant, les champs, les tableaux. Déjà utilisée sur les affiches de l'AGO.
- **Amiri** (`arabe`) : tout texte en arabe (versets, hadiths, « مرحبا »), en `dir="rtl"`, jamais en faux gras.
- Échelle : `affiche` (une fois par écran au plus), `titre-1`, `titre-2`, `titre-3`, puis `corps`, `corps-fort`, `petit`, `legende`. `etiquette` en majuscules espacées, pour les surtitres seulement.
- Toutes les polices sont libres (Google Fonts) et installables sur le serveur de rendu des documents.

## Espacements, rayons, ombres

- Espacements par multiples de 4 : `espace-2` entre libellé et champ, `espace-4` dans les cartes, `espace-6` entre champs ou cartes, `espace-8` entre sections. Marge latérale d'au moins `espace-4` sur téléphone.
- Rayons : `rayon-s` pour les champs, `rayon-m` pour boutons et cartes, `rayon-l` pour les cadres photo (l'arrondi des affiches), `rayon-plein` pour pastilles et jauges.
- Ombres discrètes : `ombre-carte` sur une carte, `ombre-flottante` sur un menu ou une fenêtre. Pas d'ombre sur un bouton.

## Images et motifs

- **Photos de membres** dans un cadre `rayon-l` avec un liseré blanc, sur un bandeau `vert-profond` qui porte le nom (blanc) et la fonction (`or`) : la carte « panéliste » des affiches Marhaba.
- **Motif du croissant** : spirales crème sur orange, avec ses points verts. À utiliser en grand et en un seul endroit (accueil, page vide), jamais en papier peint.
- **Taches et textures** douces (orange et bleu pâle à faible opacité) : réservées aux affiches. L'interface reste nette.

## Iconographie

- Icônes **Lucide** (déjà utilisées dans la première version de la plateforme), trait de 2 px, coins arrondis, 20 px dans les boutons, 16 px dans le texte. Couleur `encre` ou `vert-esatic` ; jamais `orange-croissant` seul sur fond clair.
- Pas d'emoji à la place d'une icône.

## Interaction et accessibilité

- Focus clavier visible partout : anneau `anneau-focus` plein de 2 px, décalé de 2 px.
- Contraste vérifié dans les deux thèmes : `encre` et `encre-douce` sur les fonds, `sur-vert` sur `vert-esatic`, `sur-orange` sur `orange-croissant`. Bordure des champs en `trait-champ` (3:1).
- Un champ invalide : bordure et message en `danger`, le message dit quoi corriger (« Le nom doit faire 40 caractères au plus »).
