"use client";

import { useActionState, useEffect, useRef } from "react";
import { UserPlus } from "lucide-react";
import { ajouterMembre, type EtatAction } from "./actions";
import { champ, ChampsPoste, MessageErreur, type OptionDelegation } from "./ChampsPoste";
import { LienActivation } from "./LienActivation";

/** Ajout d'un membre au mandat : nouveau compte, ou ancien membre retrouvé par son adresse. */
export function FormulaireMembre({ delegations }: { delegations: OptionDelegation[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatAction, FormData>(ajouterMembre, {});
  const formulaire = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (etat.ok) formulaire.current?.reset();
  }, [etat]);

  return (
    <div className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <h3 className="titre-3 m-0">Ajouter un membre</h3>
      <form ref={formulaire} action={envoyer} className="flex flex-col gap-4" aria-describedby={etat.erreur ? "erreur-ajout" : undefined}>
        <div className="flex flex-wrap gap-4">
          <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <label htmlFor="ajout-nom" className="text-sm font-semibold">
              Nom complet
            </label>
            <input id="ajout-nom" name="nom" required autoComplete="off" className={champ} />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
            <label htmlFor="ajout-email" className="text-sm font-semibold">
              Adresse e-mail
            </label>
            <input id="ajout-email" name="email" type="email" required autoComplete="off" placeholder="prenom.nom@esatic.edu.ci" className={champ} />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <ChampsPoste prefixe="ajout" delegations={delegations} />
        </div>
        <MessageErreur id="erreur-ajout" erreur={etat.erreur} />
        <button
          type="submit"
          disabled={enCours}
          className="flex min-h-11 items-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70"
        >
          <UserPlus size={18} aria-hidden />
          {enCours ? "Ajout…" : "Ajouter au mandat"}
        </button>
      </form>
      {etat.ok && etat.jeton && <LienActivation jeton={etat.jeton} pour={etat.pour} />}
      {etat.ok && !etat.jeton && (
        <p role="status" className="m-0 rounded-m bg-fond-succes p-3 text-sm">
          {etat.pour} a retrouvé un rôle dans le mandat. Son compte est déjà actif : il se connecte avec son mot de passe habituel.
        </p>
      )}
    </div>
  );
}
