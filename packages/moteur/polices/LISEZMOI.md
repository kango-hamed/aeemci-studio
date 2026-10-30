# Polices installées sur le serveur de rendu

Catalogue `polices.json` : nom PostScript (relevé par le plugin dans le PSD) → fichier. Une zone de gabarit qui utilise une police absente de ce catalogue est refusée à la publication et au rendu.

- **Montserrat** et **Outfit**, graisses 100 à 900 (Thin à Black), jeu de caractères latin (français compris : accents, œ, guillemets, apostrophe typographique). Licence SIL Open Font License 1.1, fichiers issus de Fontsource.
- **Amiri** (arabe) n'est pas encore installée : le moteur n'accepte qu'un fichier par police, et Fontsource sépare l'arabe et le latin. À ajouter avec le premier gabarit qui contient du texte arabe variable.

Ajouter une police : déposer le fichier `.woff2` (ou `.ttf`, `.otf`) ici, avec une licence qui autorise l'usage serveur, et ajouter sa ligne dans `polices.json` avec le nom PostScript exact (visible dans le diagnostic du plugin).
