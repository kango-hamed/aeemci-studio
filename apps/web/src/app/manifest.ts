import type { MetadataRoute } from "next";

/** Manifeste de l'application installable : icône sur l'écran d'accueil, ouverture en plein écran. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AEEMCI Studio",
    short_name: "AEEMCI",
    description: "Les documents de la section AEEMCI ESATIC, au même endroit.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf4",
    theme_color: "#0e3320",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Créer une affiche", url: "/gabarits", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Documents", url: "/documents", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
      { name: "Activités", url: "/activites", icons: [{ src: "/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
