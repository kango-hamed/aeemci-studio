"use client";

import { useActionState, useState } from "react";
import { ChevronDown, KeyRound, Palette, Pencil, UserMinus } from "lucide-react";
import { changerDesigner, lienPourMembre, modifierPoste, retirerDuMandat, type EtatAction } from "./actions";
import { ChampsPoste, MessageErreur, type OptionDelegation } from "./ChampsPoste";
import { LienActivation } from "./LienActivation";
import type { EtatCompte, MembreDuMandat } from "./requetes";
import { LIBELLES_ROLES } from "./roles";
import { coordonnee } from "./telephone";

const LIBELLES_COMPTE: Record<EtatCompte, string> = {
  actif: "Actif",
  lien_envoye: "Pas encore activé",
  lien_expire: "Lien expiré",
  sans_lien: "Pas encore activé",
};

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";

/**
 * Un membre : nom, coordonnée, poste et état du compte sur une ligne ; les actions (poste, designer, lien,
 * retrait) sont repliées derrière « Gérer ». `administrateur` : l'acteur peut changer son propre rôle.
 */
export function LigneMembre({ m, delegations, estMoi, administrateur }: { m: MembreDuMandat; delegations: OptionDelegation[]; estMoi: boolean; administrateur: boolean }) {
  const [ouvert, setOuvert] = useState(false);
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
  const idActions = `actions-${m.affectationId}`;
  const peutModifier = !estMoi || administrateur;

  return (
    <li className="flex flex-col gap-3 border-b border-trait py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-x-6 gap-y-1 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold break-words">
              {m.nom}
              {estMoi && <span className="font-normal text-encre-douce"> (toi)</span>}
            </span>
            <span className="text-sm break-all text-encre-douce">{coordonnee(m.email, m.telephone)}</span>
          </div>
          <span className="text-sm">
            {LIBELLES_ROLES[m.role]}
            {m.designer && <span className="text-encre-douce"> · designer</span>}
          </span>
          <span
            className={`justify-self-start rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
              m.compte === "actif" ? "bg-fond-succes text-encre-douce" : "bg-creme text-orange-texte"
            }`}
          >
            {LIBELLES_COMPTE[m.compte]}
          </span>
        </div>
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={idActions}
          aria-label={`Gérer ${m.nom}`}
          onClick={() => setOuvert((v) => !v)}
          className={bouton + " shrink-0"}
        >
          <span className="hidden sm:inline">Gérer</span>
          <ChevronDown size={18} aria-hidden className={`transition-transform ${ouvert ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div id={idActions} hidden={!ouvert} className="flex flex-col gap-3 rounded-m bg-creme p-3">
        <div className="flex flex-wrap gap-2">
          {peutModifier && (
            <button type="button" className={bouton + " bg-surface-relevee"} aria-expanded={edition} onClick={() => setEdition((v) => !v)}>
              <Pencil size={16} aria-hidden />
              Changer de poste
            </button>
          )}
          <form action={envoyerDesigner}>
            <input type="hidden" name="affectationId" value={m.affectationId} />
            <input type="hidden" name="designer" value={m.designer ? "0" : "1"} />
            <button type="submit" disabled={designerEnCours} className={bouton + " bg-surface-relevee"} title="Un designer importe, règle et publie les gabarits.">
              <Palette size={16} aria-hidden />
              {m.designer ? "Retirer designer" : "Rendre designer"}
            </button>
          </form>
          <form action={envoyerLien}>
            <input type="hidden" name="userId" value={m.userId} />
            <input type="hidden" name="nom" value={m.nom} />
            <button type="submit" disabled={lienEnCours} className={bouton + " bg-surface-relevee"}>
              <KeyRound size={16} aria-hidden />
              {m.compte === "actif" ? "Lien de réinitialisation" : "Nouveau lien d'activation"}
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
              <button type="submit" disabled={retraitEnCours} className={bouton + " bg-surface-relevee text-danger"}>
                <UserMinus size={16} aria-hidden />
                Retirer du mandat
              </button>
            </form>
          )}
        </div>

        {edition && (
          <form action={envoyerPoste} className="flex flex-wrap items-end gap-4" aria-describedby={erreur ? idErreur : undefined}>
            <input type="hidden" name="affectationId" value={m.affectationId} />
            <ChampsPoste prefixe={`poste-${m.affectationId}`} role={m.role} delegationId={m.delegationId} delegations={delegations} />
            <button type="submit" disabled={posteEnCours} className="flex min-h-11 items-center rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
              {posteEnCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        )}
      </div>
      <MessageErreur id={idErreur} erreur={erreur} />
      {etatLien.ok && etatLien.jeton && <LienActivation jeton={etatLien.jeton} pour={m.nom} telephone={m.telephone} />}
    </li>
  );
}
