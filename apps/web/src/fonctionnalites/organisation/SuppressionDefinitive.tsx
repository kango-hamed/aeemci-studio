"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { MOT_CONFIRMATION } from "./droits";

type Etat = { erreur?: string };

/**
 * Suppression définitive d'un document ou d'un gabarit (administrateurs) : repliée par défaut, elle dit
 * ce qui la bloque (`refus`) ou demande de recopier le mot de confirmation avant d'agir.
 */
export function SuppressionDefinitive(p: { id: string; quoi: string; consequences: string; refus: string | null; action: (e: Etat, f: FormData) => Promise<Etat> }) {
  const [etat, envoyer, enCours] = useActionState<Etat, FormData>(p.action, {});
  const [saisie, setSaisie] = useState("");
  const confirme = saisie.trim().toUpperCase() === MOT_CONFIRMATION;
  const champ = `confirmation-${p.id}`;

  return (
    <details className="group rounded-l border border-trait bg-surface-relevee p-4">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-danger">
        <Trash2 size={18} aria-hidden />
        Supprimer définitivement {p.quoi}
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="m-0 text-sm leading-5 text-encre-douce">Réservé aux administrateurs. {p.consequences} Cette action ne s&apos;annule pas et reste inscrite au journal des suppressions.</p>
        {p.refus ? (
          <p className="m-0 flex gap-2 rounded-m bg-creme p-3 text-sm">
            <AlertTriangle size={18} aria-hidden className="shrink-0 text-danger" />
            {p.refus}
          </p>
        ) : (
          <form action={envoyer} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={p.id} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={champ} className="text-sm font-semibold">
                Écris {MOT_CONFIRMATION} pour confirmer
              </label>
              <input
                id={champ}
                name="confirmation"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre"
              />
            </div>
            <button
              type="submit"
              disabled={!confirme || enCours}
              className="flex min-h-11 items-center justify-center gap-2 rounded-m border-2 border-danger px-4 font-semibold text-danger disabled:opacity-50"
            >
              <Trash2 size={18} aria-hidden />
              {enCours ? "Suppression…" : "Supprimer définitivement"}
            </button>
          </form>
        )}
        {etat.erreur && (
          <p role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-sm text-danger">
            {etat.erreur}
          </p>
        )}
      </div>
    </details>
  );
}
