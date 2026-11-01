import type { Metadata } from "next";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { activitesPourPhotos } from "@/fonctionnalites/activites/requetes";
import { gabaritsDisponibles } from "@/fonctionnalites/gabarits/requetes";
import { peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { ChoixPartage } from "@/fonctionnalites/partage/ChoixPartage";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";

export const metadata: Metadata = { title: "Partager" };

/** Arrivée d'un partage depuis la galerie du téléphone (service worker, `share_target` du manifeste). */
export default async function PagePartage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const u = await exigerUtilisateur();
  const { erreur } = await searchParams;
  const creer = peutCreerDocuments(u);
  const [activites, gabarits] = creer ? await Promise.all([activitesPourPhotos(u), gabaritsDisponibles(u)]) : [[], []];
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Partager dans AEEMCI Studio</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">Choisis où ranger ce que tu viens de partager.</p>
      </div>
      {erreur && <p className="m-0 rounded-m bg-fond-danger p-3.5 text-sm text-danger">Les fichiers partagés n&apos;ont pas pu être lus : réessaie depuis la galerie.</p>}
      {creer ? (
        <ChoixPartage
          activites={activites}
          gabarits={gabarits.filter((g) => g.aPhoto).map(({ id, nom, revisionId, aVignette }) => ({ id, nom, revisionId, aVignette }))}
          aUneDelegation={Boolean(u.affectation?.delegationId)}
        />
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      )}
    </>
  );
}
