"use client";

import { useActionState, useState } from "react";
import { enregistrerNote, type EtatMandat } from "./actions";

/** Points en suspens d'une délégation, laissés au mandat suivant. */
export function NotePassation({ cle, nom, texte }: { cle: string; nom: string; texte: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatMandat, FormData>(enregistrerNote, {});
  const [valeur, setValeur] = useState(texte);
  const id = `note-${cle}`;
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="cle" value={cle} />
      <label htmlFor={id} className="text-sm font-semibold">
        Points en suspens · {nom}
      </label>
      <textarea
        id={id}
        name="texte"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        rows={4}
        maxLength={8000}
        placeholder="Dossiers en cours, partenaires à relancer, dettes, matériel prêté…"
        className="w-full rounded-s border border-trait-champ bg-surface-relevee px-3 py-2 text-base leading-6 text-encre"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={enCours} className="flex min-h-11 items-center rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic disabled:opacity-70">
          Enregistrer
        </button>
        {etat.ok && !enCours && (
          <span role="status" className="text-sm text-succes">
            Enregistré.
          </span>
        )}
        {etat.erreur && (
          <span role="alert" className="text-sm text-danger">
            {etat.erreur}
          </span>
        )}
      </div>
    </form>
  );
}
