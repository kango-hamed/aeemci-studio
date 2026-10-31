"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FilePen, Loader2, Pencil, Send, Undo2 } from "lucide-react";
import { demanderCorrection, nouvelleVersion, soumettre, valider, type EtatCircuit } from "./actions";
import { EtatCircuit as Pastille } from "./EtatCircuit";
import type { EtatValidation } from "./types";

export interface EvenementCircuit {
  action: "soumis" | "correction_demandee" | "valide" | "nouvelle_version";
  commentaire: string | null;
  acteur: string | null;
  date: string;
}

const LIBELLES_ACTIONS: Record<EvenementCircuit["action"], string> = {
  soumis: "Soumis à validation",
  correction_demandee: "Correction demandée",
  valide: "Validé et signé",
  nouvelle_version: "Nouvelle version créée",
};

const bouton = "flex min-h-12 items-center justify-center gap-2 rounded-m px-5 font-semibold disabled:opacity-70";

function Erreur({ etat }: { etat: EtatCircuit }) {
  if (!etat.erreur) return null;
  return (
    <div role="alert" className="flex gap-2 rounded-m bg-fond-danger p-3 text-sm text-danger">
      <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
      <div>
        <p className="m-0 font-semibold">{etat.erreur}</p>
        {etat.erreurs?.length ? (
          <ul className="m-0 mt-1 pl-5">
            {etat.erreurs.map((e) => (
              <li key={e.champ}>{e.message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** État d'un document administratif dans le circuit, et ce que le membre peut y faire. */
export function PanneauCircuit(p: {
  id: string;
  etat: EtatValidation;
  numero: string | null;
  valideLe: string | null;
  modifiable: boolean;
  valideur: boolean;
  /** Ce qui manque au valideur pour valider (signature, cachet), déjà formulé. */
  manque: string[];
  evenements: EvenementCircuit[];
  versionPrecedente: string | null;
  versionSuivante: string | null;
}) {
  const [etatSoumission, envoyerSoumission, soumissionEnCours] = useActionState<EtatCircuit, FormData>(soumettre, {});
  const [etatValidation, envoyerValidation, validationEnCours] = useActionState<EtatCircuit, FormData>(valider, {});
  const [etatCorrection, envoyerCorrection, correctionEnCours] = useActionState<EtatCircuit, FormData>(demanderCorrection, {});
  const [etatVersion, envoyerVersion, versionEnCours] = useActionState<EtatCircuit, FormData>(nouvelleVersion, {});
  const enRedaction = p.etat === "redaction" || p.etat === "a_corriger";

  return (
    <section aria-labelledby="titre-circuit" className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="titre-circuit" className="titre-3 m-0">
          Validation
        </h2>
        <Pastille etat={p.etat} />
      </div>
      {p.numero && (
        <p className="m-0 text-sm">
          <span className="text-encre-douce">Numéro</span>
          <br />
          <span className="font-semibold break-all">{p.numero}</span>
          {p.valideLe && <span className="text-encre-douce"> · validé le {p.valideLe}</span>}
        </p>
      )}

      {enRedaction && p.modifiable && (
        <div className="flex flex-col gap-2">
          <Link href={`/rediger/${p.id}`} className={`${bouton} border border-vert-esatic text-vert-esatic no-underline`}>
            <Pencil size={18} aria-hidden />
            Modifier la rédaction
          </Link>
          <form action={envoyerSoumission}>
            <input type="hidden" name="id" value={p.id} />
            <button type="submit" disabled={soumissionEnCours} className={`${bouton} w-full bg-vert-esatic text-sur-vert`}>
              {soumissionEnCours ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Send size={18} aria-hidden />}
              Soumettre à la validation
            </button>
          </form>
          <Erreur etat={etatSoumission} />
        </div>
      )}

      {p.etat === "soumis" && !p.valideur && <p className="m-0 text-sm text-encre-douce">En attente de la validation du président. Il n&apos;est plus modifiable d&apos;ici là.</p>}

      {p.etat === "soumis" && p.valideur && (
        <div className="flex flex-col gap-3">
          {p.manque.length > 0 ? (
            <div className="flex flex-col gap-1 rounded-m bg-fond-attention p-3 text-sm text-attention">
              {p.manque.map((m) => (
                <p key={m} className="m-0">
                  {m}
                </p>
              ))}
              <Link href="/signature" className="font-semibold">
                Aller à la page Signature
              </Link>
            </div>
          ) : (
            <form action={envoyerValidation}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" disabled={validationEnCours} className={`${bouton} w-full bg-vert-esatic text-sur-vert`}>
                {validationEnCours ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <CheckCircle2 size={18} aria-hidden />}
                Valider et signer
              </button>
              <p className="m-0 mt-2 text-sm text-encre-douce">Le numéro est attribué, ta signature et le cachet sont apposés, le PDF devient définitif.</p>
            </form>
          )}
          <Erreur etat={etatValidation} />
          <form action={envoyerCorrection} className="flex flex-col gap-2 border-t border-trait pt-3">
            <input type="hidden" name="id" value={p.id} />
            <label htmlFor="commentaire-correction" className="text-sm font-semibold">
              Ou renvoyer en correction
            </label>
            <textarea
              id="commentaire-correction"
              name="commentaire"
              required
              rows={3}
              maxLength={2000}
              placeholder="Ce qu'il faut corriger…"
              className="w-full rounded-s border border-trait-champ bg-surface-relevee px-3 py-2 text-base text-encre"
            />
            <button type="submit" disabled={correctionEnCours} className={`${bouton} border border-trait-champ text-encre`}>
              <Undo2 size={18} aria-hidden />
              Renvoyer à l&apos;auteur
            </button>
            <Erreur etat={etatCorrection} />
          </form>
        </div>
      )}

      {p.etat === "valide" && p.modifiable && !p.versionSuivante && (
        <form action={envoyerVersion} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={p.id} />
          <button type="submit" disabled={versionEnCours} className={`${bouton} border border-trait-champ text-encre`}>
            <FilePen size={18} aria-hidden />
            Corriger (nouvelle version)
          </button>
          <p className="m-0 text-sm text-encre-douce">Ce document reste valable tel quel ; la nouvelle version refait le circuit et reçoit un nouveau numéro.</p>
          <Erreur etat={etatVersion} />
        </form>
      )}

      {(p.versionPrecedente || p.versionSuivante) && (
        <p className="m-0 flex flex-col gap-1 text-sm">
          {p.versionPrecedente && <Link href={`/documents/${p.versionPrecedente}`}>Voir la version précédente</Link>}
          {p.versionSuivante && <Link href={`/documents/${p.versionSuivante}`}>Voir la version corrigée</Link>}
        </p>
      )}

      {p.evenements.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-trait pt-3">
          <h3 className="m-0 text-sm font-semibold">Historique</h3>
          <ol className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {p.evenements.map((e, i) => (
              <li key={i} className="flex flex-col">
                <span>
                  <span className="font-semibold">{LIBELLES_ACTIONS[e.action]}</span>
                  {e.acteur ? ` par ${e.acteur}` : ""}
                </span>
                <span className="text-encre-douce">{e.date}</span>
                {e.commentaire && <span className="mt-1 whitespace-pre-line rounded-s bg-creme p-2">{e.commentaire}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
