import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { documentsDe, documentsPartages, type ResumeDocument } from "@/fonctionnalites/documents/requetes";
import { estBureau } from "@/fonctionnalites/organisation/droits";

export const metadata: Metadata = { title: "Documents" };

function Grille({ documents }: { documents: ResumeDocument[] }) {
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

export default async function PageDocuments() {
  const u = await exigerUtilisateur();
  const [miens, partages] = await Promise.all([documentsDe(u.id, 200), documentsPartages(u, 200)]);
  const titrePartages = u.estAdministrateur || estBureau(u) ? "Documents de la section" : `Documents de la délégation ${u.affectation?.delegation ?? ""}`;
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Documents</h1>
        <p className="m-0 text-encre-douce">Tes documents, et ceux que ta délégation partage, à re-télécharger quand tu veux.</p>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="titre-miens">
        <h2 id="titre-miens" className="titre-2 m-0">
          Mes documents
        </h2>
        {miens.length ? (
          <Grille documents={miens} />
        ) : (
          <p className="m-0 rounded-l bg-creme p-6">
            Tu n&apos;as encore créé aucun document. <Link href="/gabarits">Choisis un gabarit pour commencer.</Link>
          </p>
        )}
      </section>

      {partages && (
        <section className="flex flex-col gap-4" aria-labelledby="titre-partages">
          <h2 id="titre-partages" className="titre-2 m-0">
            {titrePartages}
          </h2>
          {partages.length ? (
            <Grille documents={partages} />
          ) : (
            <p className="m-0 rounded-l bg-creme p-6 text-sm">Les autres membres n&apos;ont encore rien créé.</p>
          )}
        </section>
      )}
    </>
  );
}
