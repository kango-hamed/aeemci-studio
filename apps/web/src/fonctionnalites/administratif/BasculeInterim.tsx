"use client";

import { useActionState } from "react";
import { changerInterim, type EtatCircuit } from "./actions";

/** Le président confie (ou reprend) la validation des documents officiels à l'un des vice-présidents. */
export function BasculeInterim({ interimaire, vicePresidents }: { interimaire: string | null; vicePresidents: { id: string; nom: string }[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatCircuit, FormData>(changerInterim, {});
  // Un intérimaire qui n'est plus vice-président ne valide plus : l'intérim est alors comme levé.
  const actuel = vicePresidents.find((v) => v.id === interimaire);
  return (
    <section aria-labelledby="titre-interim" className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <h2 id="titre-interim" className="titre-3 m-0">
        Intérim de la présidence
      </h2>
      <p className="m-0 text-sm text-encre-douce">
        {actuel
          ? `Intérim confié à ${actuel.nom} : validation et signature des documents officiels, avec sa propre signature et le cachet. Les autres vice-présidents ne valident pas.`
          : "En ton absence, confie l'intérim à un vice-président : seul ce vice-président pourra valider et signer les documents officiels à ta place."}
      </p>
      {actuel ? (
        <form action={envoyer}>
          <input type="hidden" name="interimaire" value="" />
          <button type="submit" disabled={enCours} className="flex min-h-12 items-center rounded-m border border-trait-champ px-4 font-semibold text-encre disabled:opacity-70">
            Lever l&apos;intérim
          </button>
        </form>
      ) : vicePresidents.length ? (
        <form action={envoyer} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="interimaire" className="font-semibold">
              Vice-président intérimaire
            </label>
            <select
              id="interimaire"
              name="interimaire"
              required
              defaultValue={vicePresidents.length === 1 ? vicePresidents[0]!.id : ""}
              className="min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre"
            >
              {vicePresidents.length > 1 && (
                <option value="" disabled>
                  Choisis un vice-président
                </option>
              )}
              {vicePresidents.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nom}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={enCours} className="flex min-h-12 items-center self-start rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
            Activer l&apos;intérim
          </button>
        </form>
      ) : (
        <p className="m-0 rounded-m bg-creme p-3 text-sm">Aucun vice-président dans le mandat : désigne-le d&apos;abord dans Organisation.</p>
      )}
      {etat.erreur && (
        <p role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-sm text-danger">
          {etat.erreur}
        </p>
      )}
    </section>
  );
}
