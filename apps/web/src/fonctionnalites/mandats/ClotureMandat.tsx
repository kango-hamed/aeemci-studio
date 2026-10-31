"use client";

import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";
import { LienActivation } from "@/fonctionnalites/organisation/LienActivation";
import { cloreMandat, continuerApresCloture, type EtatMandat } from "./actions";

const champ = "min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

/** Clôture du mandat en cours et ouverture du suivant, avec son nouveau président. */
export function ClotureMandat({ mandat }: { mandat: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatMandat, FormData>(cloreMandat, {});
  if (etat.ok)
    return (
      <div className="flex flex-col gap-3 rounded-l bg-fond-succes p-5">
        <p className="m-0 font-semibold text-succes">Mandat {etat.clos ?? mandat} clos. Le nouveau mandat est ouvert.</p>
        {etat.jeton ? (
          <LienActivation jeton={etat.jeton} pour={etat.pour} />
        ) : (
          <p className="m-0">{etat.pour} a déjà un compte : connexion avec le mot de passe habituel, puis composition du bureau dans Organisation.</p>
        )}
        <form action={continuerApresCloture}>
          <button type="submit" className="flex min-h-11 items-center rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert">
            Continuer
          </button>
        </form>
      </div>
    );
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <div className="flex gap-3 rounded-m bg-fond-attention p-4 text-attention">
        <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
        <p className="m-0">
          La clôture ne se défait pas. Les documents, activités et points en suspens du mandat {mandat} passent en lecture seule. Le nouveau mandat démarre avec son
          seul président : tous les autres rôles, le tien compris, sont à redonner. Les délégations, gabarits et signatures sont conservés.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cloture-libelle" className="font-semibold">
          Nom du nouveau mandat
        </label>
        <input id="cloture-libelle" name="libelle" required maxLength={40} placeholder="2027-2028" className={champ} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cloture-nom" className="font-semibold">
            Nouveau président
          </label>
          <input id="cloture-nom" name="nom" required maxLength={100} autoComplete="off" className={champ} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cloture-email" className="font-semibold">
            Son adresse e-mail
          </label>
          <input id="cloture-email" name="email" type="email" required autoComplete="off" className={champ} />
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="confirmation" value="1" required className="size-5 accent-vert-esatic" />
        <span>Je confirme la clôture du mandat {mandat}.</span>
      </label>
      {etat.erreur && (
        <p role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-danger">
          {etat.erreur}
        </p>
      )}
      <button type="submit" disabled={enCours} className="flex min-h-12 items-center justify-center self-start rounded-m bg-danger px-5 font-semibold text-surface disabled:opacity-70">
        Clore le mandat et ouvrir le suivant
      </button>
    </form>
  );
}
