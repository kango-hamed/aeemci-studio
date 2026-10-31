import type { Metadata } from "next";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { rechercherDocuments } from "@/fonctionnalites/documents/requetes";
import { peutCreerDocuments, peutValider } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";
import type { ResumeDocument } from "@/fonctionnalites/documents/requetes";

export const metadata: Metadata = { title: "À valider" };

function Grille({ documents, vide }: { documents: ResumeDocument[]; vide: string }) {
  if (!documents.length) return <p className="m-0 rounded-l bg-creme p-6">{vide}</p>;
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6 p-0">
      {documents.map((d) => (
        <li key={d.id} className="flex">
          <CarteDocument d={d} />
        </li>
      ))}
    </ul>
  );
}

/** Documents officiels en circuit : ceux qui attendent le président (ou le vice-président en intérim), et les miens. */
export default async function PageAValider() {
  const u = await exigerUtilisateur();
  const m = await mandatCourant();
  const valideur = peutValider(u, m?.interim ?? false);
  const [aValider, miens] = await Promise.all([
    valideur ? rechercherDocuments(u, { etats: ["soumis"] }) : Promise.resolve([]),
    rechercherDocuments(u, { portee: "miens", etats: ["redaction", "soumis", "a_corriger"] }),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="titre-1 m-0">{valideur ? "À valider" : "Documents officiels en cours"}</h1>
          <p className="m-0 max-w-[680px] text-encre-douce">
            {valideur
              ? `Lettres, procès-verbaux, attestations… soumis à ta validation${m?.interim && u.affectation?.role === "vice_president" ? " pendant l'intérim" : ""}. Valider attribue le numéro et appose ta signature avec le cachet.`
              : "Tes documents officiels pas encore validés : en rédaction, soumis au président, ou renvoyés en correction."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/signature" className="flex min-h-11 items-center gap-2 rounded-m border border-trait-champ px-4 font-semibold text-encre no-underline">
            Ma signature
          </Link>
          {peutCreerDocuments(u) && (
            <Link href="/rediger" className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert no-underline">
              <PenLine size={18} aria-hidden />
              Rédiger
            </Link>
          )}
        </div>
      </div>
      {valideur && (
        <section aria-labelledby="titre-attente" className="flex flex-col gap-4">
          <h2 id="titre-attente" className="titre-2 m-0">
            En attente de ta validation ({aValider.length})
          </h2>
          <Grille documents={aValider} vide="Rien à valider pour l'instant." />
        </section>
      )}
      <section aria-labelledby="titre-miens" className="flex flex-col gap-4">
        <h2 id="titre-miens" className="titre-2 m-0">
          Mes documents en cours
        </h2>
        <Grille documents={miens} vide="Aucun document officiel en cours." />
      </section>
    </>
  );
}
