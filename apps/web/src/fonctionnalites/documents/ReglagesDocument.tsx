"use client";

import { useActionState } from "react";
import type { StatutDocument, Visibilite } from "@/fonctionnalites/organisation/droits";
import { enregistrerDocument, type EtatModification } from "./actions";
import { visibilitesPour } from "./partage";

const champ = "min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

/** Titre, visibilité et publication d'un document, pour son auteur et le bureau. */
export function ReglagesDocument(p: { id: string; titre: string; statut: StatutDocument; visibilite: Visibilite; aUneDelegation: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatModification, FormData>(enregistrerDocument, {});
  const brouillon = p.statut === "brouillon";

  return (
    <div className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-4">
      <h2 className="titre-3 m-0">Partage</h2>
      <form action={envoyer} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={p.id} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reglage-titre" className="text-sm font-semibold">
            Titre
          </label>
          <input id="reglage-titre" name="titre" defaultValue={p.titre} required maxLength={200} className={champ} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reglage-visibilite" className="text-sm font-semibold">
            Qui peut le voir
          </label>
          <select id="reglage-visibilite" name="visibilite" defaultValue={p.visibilite} className={champ}>
            {visibilitesPour(p.aUneDelegation).map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.libelle}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" disabled={enCours} className="flex min-h-11 items-center justify-center rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic disabled:opacity-70">
          Enregistrer
        </button>
      </form>
      <form action={envoyer} className="flex flex-col gap-2 border-t border-trait pt-3">
        <input type="hidden" name="id" value={p.id} />
        <input type="hidden" name="statut" value={brouillon ? "publie" : "brouillon"} />
        <p className="m-0 text-sm leading-5 text-encre-douce">
          {brouillon ? "Brouillon : seuls toi et le bureau exécutif le voyez." : "Publié : visible selon le réglage ci-dessus."}
        </p>
        <button
          type="submit"
          disabled={enCours}
          className={
            "flex min-h-11 items-center justify-center rounded-m px-4 font-semibold disabled:opacity-70 " +
            (brouillon ? "bg-vert-esatic text-sur-vert" : "border border-trait-champ text-encre")
          }
        >
          {brouillon ? "Publier" : "Repasser en brouillon"}
        </button>
      </form>
      {etat.erreur && (
        <p role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-sm text-danger">
          {etat.erreur}
        </p>
      )}
      {etat.ok && !enCours && (
        <p role="status" className="m-0 text-sm text-succes">
          Enregistré.
        </p>
      )}
    </div>
  );
}
