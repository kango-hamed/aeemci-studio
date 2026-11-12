"use client";

import { useActionState } from "react";
import { UserMinus, UserPlus } from "lucide-react";
import { LIBELLES_ROLES, type Role } from "@/fonctionnalites/organisation/roles";
import { modifierComite, type EtatActivite } from "./actions";
import type { CandidatComite, MembreDuComite } from "./requetes";

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";
const champ = "min-h-11 min-w-0 flex-1 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";
const BUREAU = "Bureau exécutif";

function Erreur({ etat }: { etat: EtatActivite }) {
  return etat.erreur ? (
    <p role="alert" className="m-0 rounded-m bg-fond-danger p-2 text-sm text-danger">
      {etat.erreur}
    </p>
  ) : null;
}

/** Options du choix d'un membre, groupées par délégation (bureau exécutif d'abord, comme la requête). */
function Options({ candidats }: { candidats: CandidatComite[] }) {
  const groupes = new Map<string, CandidatComite[]>();
  for (const c of candidats) groupes.set(c.delegation ?? BUREAU, [...(groupes.get(c.delegation ?? BUREAU) ?? []), c]);
  return [...groupes].map(([nom, liste]) => (
    <optgroup key={nom} label={nom}>
      {liste.map((c) => (
        <option key={c.userId} value={c.userId}>
          {c.nom}
        </option>
      ))}
    </optgroup>
  ));
}

const detail = (m: MembreDuComite) => [m.delegation ?? (m.poste ? BUREAU : null), m.poste ? LIBELLES_ROLES[m.poste as Role] : "plus dans le mandat"].filter(Boolean).join(" · ");

/** PCO ou adjoint : la personne, et pour le bureau le choix d'une autre. */
function Responsable(p: { activiteId: string; role: "pco" | "adjoint"; titulaire?: MembreDuComite; candidats: CandidatComite[]; peutNommer: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierComite, {});
  const libelle = p.role === "pco" ? "PCO" : "Adjoint du PCO";
  const qui = p.role === "pco" ? "le PCO" : "l'adjoint du PCO";
  const id = `nommer-${p.role}`;
  return (
    <div className="flex flex-col gap-2 border-b border-trait pb-3">
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-encre-douce">{libelle}</span>
        {p.titulaire ? (
          <>
            <span className="font-semibold">{p.titulaire.nom}</span>
            <span className="text-sm text-encre-douce">{detail(p.titulaire)}</span>
          </>
        ) : (
          <span className="text-encre-douce">Pas encore nommé</span>
        )}
      </div>
      {p.peutNommer && (
        <form action={envoyer} className="flex flex-col gap-2">
          <input type="hidden" name="activiteId" value={p.activiteId} />
          <input type="hidden" name="operation" value={p.role} />
          <label htmlFor={id} className="sr-only">
            {p.titulaire ? `Remplacer ${qui}` : `Nommer ${qui}`}
          </label>
          <div className="flex flex-wrap gap-2">
            <select id={id} name="userId" defaultValue={p.titulaire?.userId ?? ""} key={p.titulaire?.userId ?? ""} className={champ}>
              <option value="">— Personne —</option>
              <Options candidats={p.candidats} />
            </select>
            <button type="submit" disabled={enCours} className={bouton}>
              {p.titulaire ? "Remplacer" : "Nommer"}
            </button>
          </div>
          <Erreur etat={etat} />
        </form>
      )}
    </div>
  );
}

function Membre({ activiteId, m, peutRetirer }: { activiteId: string; m: MembreDuComite; peutRetirer: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierComite, {});
  return (
    <li className="flex flex-col gap-1 border-b border-trait py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold break-words">{m.nom}</span>
          <span className="text-sm text-encre-douce">{detail(m)}</span>
        </span>
        {peutRetirer && (
          <form action={envoyer}>
            <input type="hidden" name="activiteId" value={activiteId} />
            <input type="hidden" name="operation" value="retirer" />
            <input type="hidden" name="userId" value={m.userId} />
            <button type="submit" disabled={enCours} aria-label={`Retirer ${m.nom} du comité`} className={bouton + " text-danger"}>
              <UserMinus size={16} aria-hidden />
              <span className="hidden sm:inline">Retirer</span>
            </button>
          </form>
        )}
      </div>
      <Erreur etat={etat} />
    </li>
  );
}

function Ajout({ activiteId, candidats }: { activiteId: string; candidats: CandidatComite[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierComite, {});
  if (!candidats.length) return null;
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="activiteId" value={activiteId} />
      <input type="hidden" name="operation" value="ajouter" />
      <label htmlFor="ajouter-comite" className="text-sm font-semibold">
        Ajouter au comité
      </label>
      <div className="flex flex-wrap gap-2">
        <select id="ajouter-comite" name="userId" required defaultValue="" className={champ}>
          <option value="" disabled>
            Choisir un membre…
          </option>
          <Options candidats={candidats} />
        </select>
        <button type="submit" disabled={enCours} className={bouton}>
          <UserPlus size={16} aria-hidden />
          Ajouter
        </button>
      </div>
      <Erreur etat={etat} />
    </form>
  );
}

/**
 * Comité d'organisation de l'activité : le PCO et son adjoint (nommés par le bureau), puis les membres
 * (choisis par le PCO). Tout lecteur de l'activité voit le comité ; les formulaires suivent les droits.
 */
export function GestionComite(p: { activiteId: string; comite: MembreDuComite[]; candidats: CandidatComite[]; peutNommer: boolean; peutComposer: boolean }) {
  const pco = p.comite.find((m) => m.role === "pco");
  const adjoint = p.comite.find((m) => m.role === "adjoint");
  const membres = p.comite.filter((m) => m.role === "membre");
  const dejaLa = new Set(p.comite.map((m) => m.userId));
  return (
    <section aria-labelledby="titre-comite" className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <h2 id="titre-comite" className="titre-3 m-0">
        Comité d&apos;organisation
      </h2>
      <Responsable activiteId={p.activiteId} role="pco" titulaire={pco} candidats={p.candidats} peutNommer={p.peutNommer} />
      <Responsable activiteId={p.activiteId} role="adjoint" titulaire={adjoint} candidats={p.candidats} peutNommer={p.peutNommer} />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-encre-douce">Membres ({membres.length})</span>
        {membres.length ? (
          <ul className="m-0 list-none p-0">
            {membres.map((m) => (
              <Membre key={m.userId} activiteId={p.activiteId} m={m} peutRetirer={p.peutComposer} />
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-encre-douce">{pco ? "Le PCO n'a pas encore choisi son comité." : "Le comité se compose une fois le PCO nommé."}</p>
        )}
      </div>
      {p.peutComposer && <Ajout activiteId={p.activiteId} candidats={p.candidats.filter((c) => !dejaLa.has(c.userId))} />}
    </section>
  );
}
