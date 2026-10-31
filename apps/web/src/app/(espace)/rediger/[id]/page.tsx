import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { AvisSignature } from "@/fonctionnalites/administratif/AvisSignature";
import { historique, signatureDe } from "@/fonctionnalites/administratif/circuit";
import { FormulaireRedaction } from "@/fonctionnalites/administratif/FormulaireRedaction";
import { definitionType, titreParDefaut } from "@/fonctionnalites/administratif/types";
import { documentLisible } from "@/fonctionnalites/documents/requetes";
import { peutModifierDocument } from "@/fonctionnalites/organisation/droits";

export const metadata: Metadata = { title: "Rédiger" };

export default async function PageRedaction({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ refus?: string }> }) {
  const u = await exigerUtilisateur();
  const l = await documentLisible((await params).id, u);
  const t = l?.d.typeAdministratif ? definitionType(l.d.typeAdministratif) : undefined;
  if (!l || !t || !peutModifierDocument(u, l.d)) notFound();
  if (l.d.etatValidation !== "redaction" && l.d.etatValidation !== "a_corriger") redirect(`/documents/${l.d.id}`);
  const correction = l.d.etatValidation === "a_corriger" ? (await historique(l.d.id)).findLast((e) => e.action === "correction_demandee") : undefined;
  const { refus } = await searchParams;
  const pdf = `/api/documents/${l.d.id}/fichier?v=${l.d.updatedAt.getTime()}`;

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/documents">Documents</Link>
        <span aria-hidden>›</span>
        <Link href={`/documents/${l.d.id}`}>{l.d.titre}</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">Rédaction</span>
      </nav>
      <div className="flex flex-col gap-2">
        <span className="etiquette text-orange-texte">{l.d.destinataires ? `Lettres en nombre · ${l.d.destinataires.length} destinataire${l.d.destinataires.length > 1 ? "s" : ""}` : t.libelle}</span>
        <h1 className="titre-1 m-0">{l.d.titre}</h1>
      </div>
      {correction && (
        <div role="note" className="flex flex-col gap-1 rounded-m border-l-4 border-danger bg-fond-danger p-4">
          <p className="m-0 font-semibold text-danger">Correction demandée{correction.acteur ? ` par ${correction.acteur}` : ""}</p>
          <p className="m-0 whitespace-pre-line text-encre">{correction.commentaire}</p>
        </div>
      )}
      {t.code === "PV" && l.d.auteurId === u.id && !(await signatureDe(u.id)) && (
        <AvisSignature texte="Un procès-verbal porte ta signature de secrétaire de séance : enregistre-la avant de le soumettre." />
      )}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FormulaireRedaction
          type={t.code}
          id={l.d.id}
          contenu={l.d.contenu ?? {}}
          titre={l.d.titre === titreParDefaut(t, l.d.contenu ?? {}, l.d.destinataires !== null) ? "" : l.d.titre}
          visibilite={l.d.visibilite}
          aUneDelegation={Boolean(l.d.delegationId)}
          refus={refus}
          envoi={l.d.destinataires ? { destinataires: l.d.destinataires } : undefined}
        />
        <div className="flex flex-col gap-3 lg:sticky lg:top-6">
          <h2 className="titre-3 m-0">Aperçu du projet</h2>
          <iframe src={pdf} title={`Aperçu de « ${l.d.titre} »`} className="hidden h-[85vh] w-full rounded-l border border-trait bg-surface-relevee lg:block" />
          <p className="m-0 rounded-l bg-creme p-4 lg:hidden">
            <a href={pdf}>Ouvre l&apos;aperçu PDF</a> après avoir enregistré.
          </p>
        </div>
      </div>
    </>
  );
}
