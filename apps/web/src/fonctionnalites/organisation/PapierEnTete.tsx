"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { modifierIdentite, type EtatAction } from "./actions";
import { champ, MessageErreur } from "./ChampsPoste";
import { ENTETE_PAR_DEFAUT, LIMITES_IDENTITE, rattachementParDefaut, type SaisieIdentite } from "./identite";

/** En-tête et pied de page des documents officiels. Un champ vide reprend la valeur par défaut, montrée en exemple. */
export function PapierEnTete({ section, saisie }: { section: string; saisie: SaisieIdentite }) {
  const [etat, envoyer, enCours] = useActionState<EtatAction, FormData>(modifierIdentite, {});
  const L = LIMITES_IDENTITE;

  return (
    <form action={envoyer} className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte" aria-describedby={etat.erreur ? "erreur-papier" : undefined}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="papier-entete" className="text-sm font-semibold">
          Lignes de l&apos;en-tête
        </label>
        <p id="aide-papier-entete" className="m-0 text-sm text-encre-douce">
          Entre « Association des Élèves et Étudiants Musulmans de Côte d&apos;Ivoire » et « Section {section} », une par ligne ({L.lignesEntete} au plus).
        </p>
        <textarea
          id="papier-entete"
          name="entete"
          rows={3}
          defaultValue={saisie.entete ?? ""}
          placeholder={ENTETE_PAR_DEFAUT.join("\n")}
          aria-describedby="aide-papier-entete"
          className={champ + " py-2 leading-6"}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="papier-rattachement" className="text-sm font-semibold">
          Ligne du pied de page
        </label>
        <input id="papier-rattachement" name="rattachement" defaultValue={saisie.rattachement ?? ""} maxLength={L.rattachement} placeholder={rattachementParDefaut(section)} className={champ} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="papier-email" className="text-sm font-semibold">
            E-mail de la section
          </label>
          <input id="papier-email" name="email" type="email" defaultValue={saisie.email ?? ""} maxLength={L.email} placeholder="aeemciesatic@gmail.com" className={champ} />
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="papier-telephones" className="text-sm font-semibold">
            Téléphones
          </label>
          <input id="papier-telephones" name="telephones" defaultValue={saisie.telephones ?? ""} maxLength={L.telephones} placeholder="05 44 95 53 78 / 01 02 57 67 39" className={champ} />
        </div>
      </div>
      <p className="m-0 text-sm text-encre-douce">
        Un champ vide reprend l&apos;exemple affiché (sauf l&apos;e-mail et les téléphones, alors absents). Les documents déjà validés gardent leur papier ; les
        nouveaux projets et validations prennent celui-ci.
      </p>
      <MessageErreur id="erreur-papier" erreur={etat.erreur} />
      {etat.ok && !enCours && (
        <p role="status" className="m-0 rounded-m bg-fond-succes p-3 text-succes">
          Papier à en-tête enregistré.
        </p>
      )}
      <div>
        <button type="submit" disabled={enCours} className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
          <Save size={18} aria-hidden />
          Enregistrer
        </button>
      </div>
    </form>
  );
}
