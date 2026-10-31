"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Loader2, Save, Send } from "lucide-react";
import type { Visibilite } from "@/fonctionnalites/organisation/droits";
import { visibilitesPour } from "@/fonctionnalites/documents/partage";
import { enregistrerRedaction, type EtatCircuit } from "./actions";
import { definitionType, LONGUEUR_MAX_CHAMP, type TypeAdministratif } from "./types";

const champ = "w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre aria-invalid:border-danger";

/**
 * Rédaction d'un document administratif : champs du type, titre, partage après validation.
 * Champs contrôlés : une erreur de saisie ne vide pas le formulaire.
 */
export function FormulaireRedaction(p: {
  type: TypeAdministratif;
  id?: string;
  contenu?: Record<string, string>;
  titre?: string;
  visibilite?: Visibilite;
  aUneDelegation: boolean;
  /** Message d'un refus de soumission survenu juste après la création. */
  refus?: string;
}) {
  const t = definitionType(p.type)!;
  const [etat, envoyer, enCours] = useActionState<EtatCircuit, FormData>(enregistrerRedaction, p.refus ? { erreur: p.refus } : {});
  const [contenu, setContenu] = useState<Record<string, string>>(p.contenu ?? {});
  const [titre, setTitre] = useState(p.titre ?? "");
  const [visibilite, setVisibilite] = useState<Visibilite>(p.visibilite ?? (p.aUneDelegation ? "delegation" : "bureau"));
  const erreurDe = (nom: string) => etat.erreurs?.find((x) => x.champ === nom)?.message;

  return (
    <form action={envoyer} className="flex flex-col gap-5" noValidate>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="type" value={p.type} />
      {t.champs.map((c) => {
        const id = `champ-${c.nom}`;
        const erreur = erreurDe(c.nom);
        const commun = {
          id,
          name: `c.${c.nom}`,
          value: contenu[c.nom] ?? "",
          onChange: (ev: { target: { value: string } }) => setContenu((x) => ({ ...x, [c.nom]: ev.target.value })),
          "aria-invalid": erreur ? true : undefined,
          "aria-describedby": [c.aide ? `${id}-aide` : "", erreur ? `${id}-erreur` : ""].filter(Boolean).join(" ") || undefined,
          maxLength: LONGUEUR_MAX_CHAMP[c.genre],
        };
        return (
          <div key={c.nom} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="font-semibold">
              {c.libelle}
              {!c.requis && <span className="font-normal text-encre-douce"> (facultatif)</span>}
            </label>
            {c.aide && (
              <p id={`${id}-aide`} className="m-0 text-sm text-encre-douce">
                {c.aide}
              </p>
            )}
            {c.genre === "texte" ? (
              <textarea {...commun} rows={c.nom === "corps" || c.nom === "deroulement" ? 10 : 4} placeholder={c.exemple} className={champ + " min-h-24 py-2 leading-6"} />
            ) : (
              <input {...commun} type={c.genre === "ligne" ? "text" : c.genre === "date" ? "date" : "time"} placeholder={c.exemple} className={champ + " min-h-12"} />
            )}
            {erreur && (
              <p id={`${id}-erreur`} className="m-0 text-sm text-danger">
                {erreur}
              </p>
            )}
          </div>
        );
      })}

      <fieldset className="m-0 flex flex-col gap-4 rounded-m border border-trait p-4">
        <legend className="px-1 font-semibold">Classement</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="redaction-titre" className="text-sm font-semibold">
            Titre dans la plateforme <span className="font-normal text-encre-douce">(facultatif)</span>
          </label>
          <input id="redaction-titre" name="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} placeholder={`${t.libelle} · …`} className={champ + " min-h-11"} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="redaction-visibilite" className="text-sm font-semibold">
            Qui le verra une fois validé
          </label>
          <select id="redaction-visibilite" name="visibilite" value={visibilite} onChange={(e) => setVisibilite(e.target.value as Visibilite)} className={champ + " min-h-11"}>
            {visibilitesPour(p.aUneDelegation).map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.libelle} : {v.detail}
              </option>
            ))}
          </select>
          <p className="m-0 text-sm text-encre-douce">Jusqu&apos;à la validation, seuls toi et le bureau exécutif le voyez.</p>
        </div>
      </fieldset>

      {etat.erreur && (
        <div role="alert" className="flex gap-3 rounded-m bg-fond-danger p-4 text-danger">
          <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="m-0 font-semibold">{etat.erreur}</p>
            {etat.erreurs && etat.erreurs.length > 0 && (
              <ul className="m-0 pl-5 text-sm">
                {etat.erreurs.map((x) => (
                  <li key={x.champ}>{x.message}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {etat.ok && !enCours && (
        <p role="status" className="m-0 rounded-m bg-fond-succes p-3 text-succes">
          Projet enregistré : l&apos;aperçu est à jour.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intention"
          value="enregistrer"
          disabled={enCours}
          className="flex min-h-12 items-center gap-2 rounded-m border border-vert-esatic px-5 font-semibold text-vert-esatic disabled:opacity-70"
        >
          {enCours ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Save size={18} aria-hidden />}
          Enregistrer le projet
        </button>
        <button type="submit" name="intention" value="soumettre" disabled={enCours} className="flex min-h-12 items-center gap-2 rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70">
          <Send size={18} aria-hidden />
          Soumettre à la validation
        </button>
      </div>
    </form>
  );
}
