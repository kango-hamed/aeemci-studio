"use client";

import { useActionState } from "react";
import { changerInterim, type EtatCircuit } from "./actions";

/** Le président confie (ou reprend) la validation des documents officiels au vice-président. */
export function BasculeInterim({ actif }: { actif: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatCircuit, FormData>(changerInterim, {});
  return (
    <section aria-labelledby="titre-interim" className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <h2 id="titre-interim" className="titre-3 m-0">
        Intérim de la présidence
      </h2>
      <p className="m-0 text-sm text-encre-douce">
        {actif
          ? "Intérim activé : le vice-président valide et signe les documents officiels, avec sa propre signature et le cachet."
          : "En ton absence, active l'intérim : le vice-président pourra valider et signer les documents officiels à ta place."}
      </p>
      <form action={envoyer}>
        <input type="hidden" name="actif" value={actif ? "0" : "1"} />
        <button
          type="submit"
          disabled={enCours}
          className={"flex min-h-12 items-center rounded-m px-4 font-semibold disabled:opacity-70 " + (actif ? "border border-trait-champ text-encre" : "bg-vert-esatic text-sur-vert")}
        >
          {actif ? "Lever l'intérim" : "Activer l'intérim"}
        </button>
      </form>
      {etat.erreur && (
        <p role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-sm text-danger">
          {etat.erreur}
        </p>
      )}
    </section>
  );
}
