import { EnTete } from "@/fonctionnalites/accueil/EnTete";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { nombreAValider } from "@/fonctionnalites/documents/requetes";
import { peutValider } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

/** Pages réservées aux membres connectés : en-tête commun, session vérifiée côté serveur. */
export default async function LayoutEspace({ children }: { children: React.ReactNode }) {
  const utilisateur = await exigerUtilisateur();
  const valideur = utilisateur.affectation ? peutValider(utilisateur, (await mandatCourant())?.interim ?? false) : false;
  const aValider = valideur ? await nombreAValider() : null;
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:rounded-m focus:bg-surface-relevee focus:p-3"
      >
        Aller au contenu
      </a>
      <EnTete utilisateur={utilisateur} aValider={aValider} />
      <main id="contenu" className="mx-auto box-border flex w-full max-w-[1200px] flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
        {children}
      </main>
    </div>
  );
}
