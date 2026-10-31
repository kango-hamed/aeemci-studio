"use client";

import { useActionState, useState } from "react";
import { KeyRound, Palette, Pencil, UserMinus } from "lucide-react";
import { changerDesigner, lienPourMembre, modifierPoste, retirerDuMandat, type EtatAction } from "./actions";
import { ChampsPoste, MessageErreur, type OptionDelegation } from "./ChampsPoste";
import { LienActivation } from "./LienActivation";
import type { EtatCompte, MembreDuMandat } from "./requetes";
import { LIBELLES_ROLES } from "./roles";

const LIBELLES_COMPTE: Record<EtatCompte, string> = {
  actif: "Compte actif",
  lien_envoye: "Lien envoyé, pas encore activé",
  lien_expire: "Lien expiré",
  sans_lien: "Pas encore activé",
};

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";

export function LigneMembre({ m, delegations, estMoi }: { m: MembreDuMandat; delegations: OptionDelegation[]; estMoi: boolean }) {
  const [edition, setEdition] = useState(false);
  const [etatPoste, envoyerPoste, posteEnCours] = useActionState<EtatAction, FormData>(async (e, f) => {
    const r = await modifierPoste(e, f);
    if (r.ok) setEdition(false);
    return r;
  }, {});
  const [etatRetrait, envoyerRetrait, retraitEnCours] = useActionState<EtatAction, FormData>(retirerDuMandat, {});
  const [etatLien, envoyerLien, lienEnCours] = useActionState<EtatAction, FormData>(lienPourMembre, {});
  const [etatDesigner, envoyerDesigner, designerEnCours] = useActionState<EtatAction, FormData>(changerDesigner, {});
  const erreur = etatPoste.erreur ?? etatRetrait.erreur ?? etatLien.erreur ?? etatDesigner.erreur;
  const idErreur = `erreur-${m.affectationId}`;

  return (
    <li className="flex flex-col gap-3 border-b border-trait py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex min-w-[220px] flex-1 flex-col">
          <span className="font-semibold">
            {m.nom}
            {estMoi && <span className="font-normal text-encre-douce"> (toi)</span>}
          </span>
          <span className="text-sm break-all text-encre-douce">{m.email}</span>
        </div>
        <div className="flex min-w-[200px] flex-1 flex-col">
          <span>{LIBELLES_ROLES[m.role]}</span>
          <span className="text-sm text-encre-douce">
            {m.delegation ?? "Bureau exécutif"}
            {m.designer && " · designer"}
          </span>
        </div>
        <span className={"text-sm " + (m.compte === "actif" ? "text-encre-douce" : "font-semibold text-orange-texte")}>{LIBELLES_COMPTE[m.compte]}</span>
        <div className="flex flex-wrap gap-2">
          {!estMoi && (
            <button type="button" className={bouton} aria-expanded={edition} onClick={() => setEdition((v) => !v)}>
              <Pencil size={16} aria-hidden />
              Modifier
            </button>
          )}
          <form action={envoyerDesigner}>
            <input type="hidden" name="affectationId" value={m.affectationId} />
            <input type="hidden" name="designer" value={m.designer ? "0" : "1"} />
            <button type="submit" disabled={designerEnCours} className={bouton} title="Un designer importe, règle et publie les gabarits.">
              <Palette size={16} aria-hidden />
              {m.designer ? "Retirer designer" : "Designer"}
            </button>
          </form>
          <form action={envoyerLien}>
            <input type="hidden" name="userId" value={m.userId} />
            <input type="hidden" name="nom" value={m.nom} />
            <button type="submit" disabled={lienEnCours} className={bouton}>
              <KeyRound size={16} aria-hidden />
              {m.compte === "actif" ? "Lien de réinitialisation" : "Nouveau lien"}
            </button>
          </form>
          {!estMoi && (
            <form
              action={envoyerRetrait}
              onSubmit={(e) => {
                if (!confirm(`Retirer ${m.nom} du mandat ? Son compte reste, mais il ne pourra plus créer de documents.`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="affectationId" value={m.affectationId} />
              <button type="submit" disabled={retraitEnCours} className={bouton + " text-danger"}>
                <UserMinus size={16} aria-hidden />
                Retirer
              </button>
            </form>
          )}
        </div>
      </div>

      {edition && (
        <form action={envoyerPoste} className="flex flex-wrap items-end gap-4 rounded-m bg-creme p-4" aria-describedby={erreur ? idErreur : undefined}>
          <input type="hidden" name="affectationId" value={m.affectationId} />
          <ChampsPoste prefixe={`poste-${m.affectationId}`} role={m.role} delegationId={m.delegationId} delegations={delegations} />
          <button type="submit" disabled={posteEnCours} className="flex min-h-11 items-center rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
            {posteEnCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
      <MessageErreur id={idErreur} erreur={erreur} />
      {etatLien.ok && etatLien.jeton && <LienActivation jeton={etatLien.jeton} pour={m.nom} />}
    </li>
  );
}
