import { LIBELLES_ETATS, type EtatValidation } from "./types";

const STYLES: Record<EtatValidation, string> = {
  redaction: "bg-encre text-surface",
  soumis: "bg-orange-croissant text-sur-orange",
  a_corriger: "bg-danger text-surface",
  valide: "bg-vert-esatic text-sur-vert",
};

/** Pastille de l'état d'un document administratif dans le circuit de validation. */
export function EtatCircuit({ etat, className = "" }: { etat: EtatValidation; className?: string }) {
  return <span className={`rounded-s px-2 py-1 text-xs font-semibold ${STYLES[etat]} ${className}`}>{LIBELLES_ETATS[etat]}</span>;
}
