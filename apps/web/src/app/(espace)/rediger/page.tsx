import type { Metadata } from "next";
import Link from "next/link";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { FormulaireRedaction } from "@/fonctionnalites/administratif/FormulaireRedaction";
import { AvisSignature } from "@/fonctionnalites/administratif/AvisSignature";
import { definitionType, TYPES_ADMINISTRATIFS } from "@/fonctionnalites/administratif/types";
import { signatureDe } from "@/fonctionnalites/administratif/circuit";
import { texteDuModele, type ModeleEnvoi } from "@/fonctionnalites/administratif/envois";
import { dateSaisie, heureSaisie } from "@/fonctionnalites/administratif/mise-en-page";
import { activiteLisible } from "@/fonctionnalites/activites/requetes";
import { peutCreerDocuments, peutModifierActivite } from "@/fonctionnalites/organisation/droits";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";

export const metadata: Metadata = { title: "Rédiger un document officiel" };

const MODELES: { modele: ModeleEnvoi; libelle: string; description: string }[] = [
  { modele: "invitation", libelle: "Lettres d'invitation", description: "Inviter des personnalités ou des partenaires à une activité, une lettre à leur nom." },
  { modele: "dons", libelle: "Demandes de dons", description: "Solliciter un soutien auprès de plusieurs donateurs, chacun avec sa lettre." },
  { modele: "libre", libelle: "Autre lettre en nombre", description: "Une même lettre à plusieurs destinataires, rédigée librement." },
];

export default async function PageRediger({ searchParams }: { searchParams: Promise<{ type?: string; envoi?: string; activite?: string }> }) {
  const u = await exigerUtilisateur();
  const p = await searchParams;
  const modele = MODELES.find((m) => m.modele === p.envoi);
  const t = modele ? definitionType("LET") : definitionType(p.type ?? "");

  // Envoi créé depuis une activité : rattaché à elle, et le modèle reprend son titre, sa date et son lieu.
  const activite = modele && p.activite && /^[0-9a-f-]{36}$/.test(p.activite) ? await activiteLisible(p.activite, u) : null;
  const rattachable = activite && peutModifierActivite(u, activite.a) ? activite.a : null;
  const section = modele ? ((await mandatCourant())?.section ?? "") : "";
  const contenuModele =
    modele &&
    texteDuModele(
      modele.modele,
      rattachable && { titre: rattachable.titre, lieu: rattachable.lieu, quand: dateSaisie(rattachable.date) + (rattachable.heure ? ` à ${heureSaisie(rattachable.heure)}` : "") },
      section,
    );

  const titre = modele ? modele.libelle : t ? t.libelle : "Rédiger un document officiel";
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        {rattachable ? <Link href={`/activites/${rattachable.id}`}>{rattachable.titre}</Link> : <Link href="/documents">Documents</Link>}
        <span aria-hidden>›</span>
        {t ? <Link href="/rediger">Rédiger</Link> : <span aria-current="page">Rédiger</span>}
        {t && (
          <>
            <span aria-hidden>›</span>
            <span aria-current="page">{titre}</span>
          </>
        )}
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="titre-1 m-0">{titre}</h1>
        <p className="m-0 max-w-[680px] text-encre-douce">
          {modele
            ? "Une lettre type, une liste de destinataires (fichier CSV) : chacun reçoit sa lettre, numérotée, signée et cachetée. Le président valide l'envoi une seule fois."
            : t
              ? t.description
              : "En-tête officiel, numéro, signature et cachet : le document est mis en page pour toi, puis validé par le président avant de partir."}
        </p>
      </div>
      {!peutCreerDocuments(u) ? (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      ) : t ? (
        <div className="flex max-w-[720px] flex-col gap-6">
          {t.code === "PV" && !(await signatureDe(u.id)) && <AvisSignature texte="Un procès-verbal porte ta signature de secrétaire de séance : enregistre-la avant de le soumettre." />}
          <FormulaireRedaction
            type={t.code}
            aUneDelegation={Boolean(u.affectation?.delegationId)}
            contenu={contenuModele || undefined}
            envoi={modele ? { destinataires: [] } : undefined}
            activiteId={rattachable?.id}
          />
        </div>
      ) : (
        <>
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
          <h2 className="titre-2 m-0">Lettres en nombre</h2>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-0">
            {MODELES.map((x) => (
              <li key={x.modele} className="flex">
                <Link
                  href={`/rediger?envoi=${x.modele}`}
                  className="group flex w-full flex-col gap-1 rounded-l border border-trait bg-surface-relevee p-5 text-encre no-underline shadow-carte hover:border-vert-esatic"
                >
                  <span className="etiquette text-orange-texte">LET · en nombre</span>
                  <span className="titre-3 group-hover:text-vert-esatic">{x.libelle}</span>
                  <span className="text-sm leading-5 text-encre-douce">{x.description}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="m-0 text-sm text-encre-douce">Pour une activité, pars de sa page : la lettre reprend son titre, sa date et son lieu, et s&apos;y rattache.</p>
        </>
      )}
    </>
  );
}
