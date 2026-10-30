"use client";

import { useActionState } from "react";
import { activerCompte, type EtatActivation } from "./actions";

const champ =
  "min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre aria-invalid:border-danger";

export function FormulaireActivation({ jeton, nom, email, reinitialisation }: { jeton: string; nom: string; email: string; reinitialisation: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivation, FormData>(activerCompte, {});
  const erreur = etat.erreur;
  const decrit = erreur ? "erreur-activation" : "aide-mot-de-passe";

  return (
    <form action={envoyer} className="flex w-full max-w-[380px] flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <h2 className="titre-1 m-0 text-[28px] leading-[34px]">{reinitialisation ? "Nouveau mot de passe" : "Activer ton compte"}</h2>
        <p className="m-0 text-encre-douce">
          {nom} · {email}
        </p>
      </div>

      {erreur && (
        <p id="erreur-activation" role="alert" className="m-0 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
          {erreur}
        </p>
      )}

      <input type="hidden" name="jeton" value={jeton} />
      {/* Aide les gestionnaires de mots de passe à associer le mot de passe au bon compte. */}
      <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />

      <div className="flex flex-col gap-2">
        <label htmlFor="motDePasse" className="font-semibold">
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit}
          className={champ}
        />
        <p id="aide-mot-de-passe" className="m-0 text-sm text-encre-douce">
          10 caractères au moins. Une courte phrase est plus facile à retenir.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="confirmation" className="font-semibold">
          Confirme le mot de passe
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? "erreur-activation" : undefined}
          className={champ}
        />
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="flex min-h-12 items-center justify-center rounded-m bg-vert-esatic text-base font-semibold text-sur-vert disabled:opacity-70"
      >
        {enCours ? "Enregistrement…" : reinitialisation ? "Changer le mot de passe" : "Activer et me connecter"}
      </button>
    </form>
  );
}
