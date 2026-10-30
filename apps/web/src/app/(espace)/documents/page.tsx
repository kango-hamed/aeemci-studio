import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { documentsDe } from "@/fonctionnalites/documents/requetes";

export const metadata: Metadata = { title: "Mes documents" };

export default async function PageDocuments() {
  const u = await exigerUtilisateur();
  const documents = await documentsDe(u.id, 200);
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">Mes documents</h1>
        <p className="m-0 text-encre-douce">Tous les documents que tu as créés, à re-télécharger quand tu veux.</p>
      </div>
      {documents.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6 p-0">
          {documents.map((d) => (
            <li key={d.id} className="flex">
              <CarteDocument d={d} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">
          Tu n&apos;as encore créé aucun document. <Link href="/gabarits">Choisis un gabarit pour commencer.</Link>
        </p>
      )}
    </>
  );
}
