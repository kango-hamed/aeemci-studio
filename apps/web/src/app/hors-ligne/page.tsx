import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Pas de connexion" };

/** Servie par le service worker quand une page ne peut pas être chargée. Statique : aucune donnée de membre. */
export default function PageHorsLigne() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface px-6 text-center">
      <span className="flex rounded-m bg-surface-relevee px-3 py-2 shadow-carte">
        {/* eslint-disable-next-line @next/next/no-img-element -- fichier public mis en cache par le service worker (l'optimiseur d'images ne l'est pas) */}
        <img src="/logo-aeemci-esatic.png" alt="Logo AEEMCI ESATIC" width={81} height={48} />
      </span>
      <WifiOff size={40} aria-hidden className="text-orange-texte" />
      <div className="flex max-w-[360px] flex-col gap-2">
        <h1 className="titre-2 m-0">Pas de connexion</h1>
        <p className="m-0 text-encre-douce">AEEMCI Studio a besoin d&apos;internet pour afficher tes documents. Vérifie ta connexion, puis réessaie.</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- rechargement complet voulu : la page vient du cache du service worker */}
      <a href="/" className="flex min-h-12 items-center rounded-m bg-vert-esatic px-6 font-semibold text-sur-vert no-underline">
        Réessayer
      </a>
    </main>
  );
}
