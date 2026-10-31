import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Lock, MapPin } from "lucide-react";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { FormulaireActivite } from "@/fonctionnalites/activites/FormulaireActivite";
import { DetacherDocument, RattacherDocument, SupprimerActivite } from "@/fonctionnalites/activites/GestionActivite";
import { activiteLisible } from "@/fonctionnalites/activites/requetes";
import { dateSaisie, heureSaisie } from "@/fonctionnalites/administratif/mise-en-page";
import { CarteDocument } from "@/fonctionnalites/documents/CarteDocument";
import { ChoixFichiers } from "@/fonctionnalites/documents/ChoixFichiers";
import { libelleVisibilite } from "@/fonctionnalites/documents/partage";
import { rechercherDocuments } from "@/fonctionnalites/documents/requetes";
import { estBureau, peutCreerDocuments, peutModifierActivite } from "@/fonctionnalites/organisation/droits";
import { delegationsDe, mandatCourant } from "@/fonctionnalites/organisation/requetes";

export const metadata: Metadata = { title: "Activité" };

export default async function PageActivite({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerUtilisateur();
  const l = await activiteLisible((await params).id, u);
  if (!l) notFound();
  const a = l.a;
  const modifiable = peutModifierActivite(u, a);
  const bureau = u.estAdministrateur || estBureau(u);
  const [documents, candidats, delegations] = await Promise.all([
    rechercherDocuments(u, { activiteId: a.id }),
    modifiable ? rechercherDocuments(u, { mandatId: a.mandatId, sansActivite: true }, 50) : [],
    modifiable && bureau ? mandatCourant().then((m) => (m ? delegationsDe(m.sectionId, m.id) : [])) : undefined,
  ]);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/activites">Activités</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">{a.titre}</span>
      </nav>
      <div className="flex flex-col gap-2">
        <span className="etiquette text-orange-texte">
          {l.delegation ?? "Bureau exécutif"} · mandat {l.mandat}
        </span>
        <h1 className="titre-1 m-0">{a.titre}</h1>
        <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-encre-douce">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={18} aria-hidden />
            {dateSaisie(a.date)}
            {a.heure ? ` · ${heureSaisie(a.heure)}` : ""}
          </span>
          {a.lieu && (
            <span className="flex items-center gap-1.5">
              <MapPin size={18} aria-hidden />
              {a.lieu}
            </span>
          )}
          <span>
            {libelleVisibilite(a.visibilite) === "Ma délégation" ? "Visible par la délégation" : `Visible : ${libelleVisibilite(a.visibilite).toLowerCase()}`} · créée par {l.auteur}
          </span>
        </p>
        {a.fige && (
          <p className="m-0 flex items-center gap-2 self-start rounded-m bg-creme px-3 py-2 text-sm">
            <Lock size={16} aria-hidden />
            Mandat clos : lecture seule.
          </p>
        )}
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          {a.description && <p className="m-0 max-w-[680px] whitespace-pre-line">{a.description}</p>}
          <section aria-labelledby="titre-bilan" className="flex flex-col gap-2 rounded-l bg-creme p-5">
            <h2 id="titre-bilan" className="titre-3 m-0">
              Bilan
            </h2>
            <p className={"m-0 whitespace-pre-line " + (a.bilan ? "" : "text-encre-douce")}>
              {a.bilan ?? (a.date < new Date().toISOString().slice(0, 10) ? "Bilan à rédiger : il entre dans le dossier de passation." : "Le bilan se rédige après l'activité.")}
            </p>
          </section>
          <section aria-labelledby="titre-documents" className="flex flex-col gap-4">
            <h2 id="titre-documents" className="titre-2 m-0">
              Documents et photos ({documents.length})
            </h2>
            {documents.length ? (
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-0">
                {documents.map((d) => (
                  <li key={d.id} className="flex flex-col gap-2">
                    <CarteDocument d={d} />
                    {modifiable && <DetacherDocument documentId={d.id} activiteId={a.id} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-encre-douce">Aucun document rattaché pour l&apos;instant.</p>
            )}
          </section>
        </div>

        {modifiable && (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="titre-ajouter" className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
              <h2 id="titre-ajouter" className="titre-3 m-0">
                Ajouter
              </h2>
              <ChoixFichiers id="photos-activite" libelle="Ajouter des photos ou des fichiers" accept="image/*,application/pdf" champs={{ activiteId: a.id }} />
              <RattacherDocument activiteId={a.id} candidats={candidats.filter((d) => bureau || d.estAMoi).map((d) => ({ id: d.id, titre: d.titre }))} />
              {peutCreerDocuments(u) && (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm font-semibold">Lettres personnalisées, une par destinataire</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/rediger?envoi=invitation&activite=${a.id}`} className="flex min-h-11 items-center rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic no-underline">
                      Lettres d&apos;invitation
                    </Link>
                    <Link href={`/rediger?envoi=dons&activite=${a.id}`} className="flex min-h-11 items-center rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic no-underline">
                      Demandes de dons
                    </Link>
                  </div>
                </div>
              )}
              <p className="m-0 text-sm text-encre-douce">
                Une affiche ou un document officiel se crée depuis <Link href="/gabarits">Créer</Link> ou <Link href="/rediger">Rédiger</Link>, puis se rattache ici.
              </p>
            </section>
            <details className="rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
              <summary className="cursor-pointer font-semibold">Modifier la fiche et le bilan</summary>
              <div className="mt-4">
                <FormulaireActivite
                  id={a.id}
                  delegations={delegations}
                  aUneDelegation={Boolean(a.delegationId)}
                  valeurs={{
                    titre: a.titre,
                    date: a.date,
                    heure: a.heure ?? "",
                    lieu: a.lieu ?? "",
                    description: a.description ?? "",
                    bilan: a.bilan ?? "",
                    visibilite: a.visibilite,
                    delegationId: a.delegationId ?? "",
                  }}
                />
              </div>
            </details>
            <SupprimerActivite id={a.id} />
          </div>
        )}
      </div>
    </>
  );
}
