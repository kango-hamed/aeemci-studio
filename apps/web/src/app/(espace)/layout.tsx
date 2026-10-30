import { EnTete } from "@/fonctionnalites/accueil/EnTete";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";

/** Pages réservées aux membres connectés : en-tête commun, session vérifiée côté serveur. */
export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerUtilisateur();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-m focus:bg-surface-relevee focus:p-3"
      >
        Aller au contenu
      </a>
      <EnTete utilisateur={utilisateur} />
      <main id="contenu" className="mx-auto box-border flex w-full max-w-[1200px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
