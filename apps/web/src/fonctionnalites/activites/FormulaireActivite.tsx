"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import type { Visibilite } from "@/fonctionnalites/organisation/droits";
import { VISIBILITES } from "@/fonctionnalites/documents/partage";
import { enregistrerActivite, type EtatActivite } from "./actions";

const champ = "w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

export interface ValeursActivite {
  titre: string;
  date: string;
  heure: string;
  lieu: string;
  description: string;
  bilan: string;
  visibilite: Visibilite;
  delegationId: string;
}

/**
 * Fiche d'activité (création ou modification, bilan compris). Champs contrôlés : une erreur ne vide rien.
 * `delegations` : pour le bureau, qui choisit la délégation organisatrice ; absent pour un membre (la sienne).
 */
export function FormulaireActivite(p: { id?: string; valeurs?: Partial<ValeursActivite>; delegations?: { id: string; nom: string }[]; aUneDelegation: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(enregistrerActivite, {});
  const [v, setV] = useState<ValeursActivite>({
    titre: "",
    date: "",
    heure: "",
    lieu: "",
    description: "",
    bilan: "",
    visibilite: "section",
    delegationId: "",
    ...p.valeurs,
  });
  const maj = (k: keyof ValeursActivite) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }));
  const avecDelegation = p.delegations ? Boolean(v.delegationId) : p.aUneDelegation;

  return (
    <form action={envoyer} className="flex flex-col gap-5">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="activite-titre" className="font-semibold">
          Titre
        </label>
        <input id="activite-titre" name="titre" value={v.titre} onChange={maj("titre")} required maxLength={200} placeholder="Conférence de rentrée" className={champ + " min-h-12"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="activite-date" className="font-semibold">
            Date
          </label>
          <input id="activite-date" name="date" type="date" value={v.date} onChange={maj("date")} required className={champ + " min-h-12"} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="activite-heure" className="font-semibold">
            Heure <span className="font-normal text-encre-douce">(facultatif)</span>
          </label>
          <input id="activite-heure" name="heure" type="time" value={v.heure} onChange={maj("heure")} className={champ + " min-h-12"} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="activite-lieu" className="font-semibold">
          Lieu <span className="font-normal text-encre-douce">(facultatif)</span>
        </label>
        <input id="activite-lieu" name="lieu" value={v.lieu} onChange={maj("lieu")} maxLength={200} placeholder="Amphithéâtre A, ESATIC" className={champ + " min-h-12"} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="activite-description" className="font-semibold">
          Description <span className="font-normal text-encre-douce">(facultatif)</span>
        </label>
        <textarea id="activite-description" name="description" value={v.description} onChange={maj("description")} rows={4} maxLength={4000} className={champ + " py-2 leading-6"} />
      </div>
      {p.id && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="activite-bilan" className="font-semibold">
            Bilan
          </label>
          <p id="activite-bilan-aide" className="m-0 text-sm text-encre-douce">
            Après l&apos;activité : déroulement, participation, ce qui a marché, ce qu&apos;il faut améliorer. Il entre dans le dossier de passation.
          </p>
          <textarea
            id="activite-bilan"
            name="bilan"
            value={v.bilan}
            onChange={maj("bilan")}
            rows={6}
            maxLength={8000}
            aria-describedby="activite-bilan-aide"
            className={champ + " py-2 leading-6"}
          />
        </div>
      )}
      <fieldset className="m-0 flex flex-col gap-4 rounded-m border border-trait p-4">
        <legend className="px-1 font-semibold">Organisation et partage</legend>
        {p.delegations && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="activite-delegation" className="text-sm font-semibold">
              Organisée par
            </label>
            <select id="activite-delegation" name="delegationId" value={v.delegationId} onChange={maj("delegationId")} className={champ + " min-h-11"}>
              <option value="">Bureau exécutif</option>
              {p.delegations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nom}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="activite-visibilite" className="text-sm font-semibold">
            Qui la voit
          </label>
          <select id="activite-visibilite" name="visibilite" value={v.visibilite} onChange={maj("visibilite")} className={champ + " min-h-11"}>
            {VISIBILITES.filter((x) => avecDelegation || x.valeur !== "delegation").map((x) => (
              <option key={x.valeur} value={x.valeur}>
                {x.libelle === "Ma délégation" ? "La délégation organisatrice" : x.libelle}
              </option>
            ))}
          </select>
          <p className="m-0 text-sm text-encre-douce">Les photos ajoutées à l&apos;activité sont partagées de la même façon.</p>
        </div>
      </fieldset>
      {etat.erreur && (
        <p role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3 text-danger">
          <AlertTriangle size={20} aria-hidden className="shrink-0" />
          {etat.erreur}
        </p>
      )}
      {etat.ok && !enCours && (
        <p role="status" className="m-0 rounded-m bg-fond-succes p-3 text-succes">
          Activité enregistrée.
        </p>
      )}
      <button type="submit" disabled={enCours} className="flex min-h-12 items-center justify-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70">
        {enCours ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Save size={18} aria-hidden />}
        {p.id ? "Enregistrer" : "Créer l'activité"}
      </button>
    </form>
  );
}
