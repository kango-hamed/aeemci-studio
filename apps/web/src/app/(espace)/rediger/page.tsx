import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { FormulaireRedaction } from "@/fonctionnalites/administratif/FormulaireRedaction";
import { AvisSignature } from "@/fonctionnalites/administratif/AvisSignature";
import { definitionType, TYPES_ADMINISTRATIFS } from "@/fonctionnalites/administratif/types";
import { signatureDe } from "@/fonctionnalites/administratif/circuit";
import { peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";

export const metadata: Metadata = { title: "Rédiger un document officiel" };

export default async function PageRediger({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const u = await exigerUtilisateur();
  const t = definitionType((await searchParams).type ?? "");

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/documents">Documents</Link>
        <span aria-hidden>›</span>
        {t ? <Link href="/rediger">Rédiger</Link> : <span aria-current="page">Rédiger</span>}
        {t && (
          <>
            <span aria-hidden>›</span>
            <span aria-current="page">{t.libelle}</span>
          </>
        )}
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">{t ? t.libelle : "Rédiger un document officiel"}</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          {t
            ? t.description
            : "En-tête officiel, numéro, signature et cachet : le document est mis en page pour toi, puis validé par le président avant de partir."}
        </p>
      </div>
      {!peutCreerDocuments(u) ? (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      ) : t ? (
        <div className="flex max-w-[720px] flex-col gap-6">
          {t.code === "PV" && !(await signatureDe(u.id)) && <AvisSignature texte="Un procès-verbal porte ta signature de secrétaire de séance : enregistre-la avant de le soumettre." />}
          <FormulaireRedaction type={t.code} aUneDelegation={Boolean(u.affectation?.delegationId)} />
        </div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-0">
          {TYPES_ADMINISTRATIFS.map((x) => (
            <li key={x.code} className="flex">
              <Link
                href={`/rediger?type=${x.code}`}
                className="group flex w-full flex-col gap-1 rounded-l border border-trait bg-surface-relevee p-5 text-encre no-underline shadow-carte hover:border-vert-esatic"
              >
                <span className="etiquette text-orange-texte">{x.code}</span>
                <span className="titre-3 group-hover:text-vert-esatic">{x.libelle}</span>
                <span className="text-sm leading-5 text-encre-douce">{x.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
