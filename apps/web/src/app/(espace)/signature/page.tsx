import type { Metadata } from "next";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { cachetDeSection, signatureDe } from "@/fonctionnalites/administratif/circuit";
import { BasculeInterim } from "@/fonctionnalites/administratif/BasculeInterim";
import { ImageSignature } from "@/fonctionnalites/administratif/ImageSignature";
import { peutCreerDocuments, peutGererCachet } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";

export const metadata: Metadata = { title: "Signature et cachet" };

export default async function PageSignature() {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const president = peutGererCachet(u);
  const [signature, cachet] = await Promise.all([signatureDe(u.id), president && m ? cachetDeSection(m.sectionId) : null]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">{president ? "Signature et cachet" : "Ma signature"}</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          Ta signature est apposée sur les documents officiels que tu signes : à la validation pour le président, à la soumission d&apos;un procès-verbal pour le
          secrétaire de séance. Elle reste privée : seule la plateforme la lit pour l&apos;apposer.
        </p>
      </div>
      {peutCreerDocuments(u) ? (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 md:grid-cols-2">
          <ImageSignature
            quoi="signature"
            titre="Ma signature"
            aide="Signe sur une feuille blanche, au stylo noir ou bleu, puis prends-la en photo bien à plat. Le fond blanc est retiré automatiquement."
            actuelle={signature ? `/api/signature?v=${encodeURIComponent(signature)}` : null}
          />
          {president && (
            <ImageSignature
              quoi="cachet"
              titre="Cachet de la section"
              aide="Tamponne le cachet sur une feuille blanche, puis prends-le en photo bien à plat. Il est apposé sur chaque document validé."
              actuelle={cachet ? `/api/signature?quoi=cachet&v=${encodeURIComponent(cachet)}` : null}
            />
          )}
          {president && m && <BasculeInterim actif={m.interim} />}
        </div>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      )}
    </>
  );
}
