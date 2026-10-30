"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "./actions";

const champ =
  "min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre aria-invalid:border-danger";

export function FormulaireConnexion({ suite }: { suite: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatConnexion, FormData>(seConnecter, {});
  const erreur = etat.erreur;

  return (
    <form action={envoyer} className="flex w-full max-w-[380px] flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <h2 className="titre-1 m-0 text-[28px] leading-[34px]">Connexion</h2>
        <p className="m-0 text-encre-douce">Réservée aux membres des bureaux de la section ESATIC.</p>
      </div>

      {erreur && (
        <p id="erreur-connexion" role="alert" className="m-0 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
          {erreur}
        </p>
      )}

      <input type="hidden" name="suite" value={suite} />

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="font-semibold">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={etat.email}
          placeholder="prenom.nom@esatic.edu.ci"
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? "erreur-connexion" : undefined}
          className={champ}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="motDePasse" className="font-semibold">
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? "erreur-connexion" : undefined}
          className={champ}
        />
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="flex min-h-12 items-center justify-center rounded-m bg-vert-esatic text-base font-semibold text-sur-vert disabled:opacity-70"
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>

      <p className="m-0 rounded-m bg-creme p-3.5 text-sm leading-5">
        Pas encore de compte ? Les accès sont créés par le bureau exécutif à chaque mandat : demande-le au secrétaire
        général de la section. Mot de passe oublié : même chemin, il peut le réinitialiser.
      </p>
    </form>
  );
}
