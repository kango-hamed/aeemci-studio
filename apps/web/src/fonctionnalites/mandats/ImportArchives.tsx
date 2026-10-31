"use client";

import { useState } from "react";
import { ChoixFichiers } from "@/fonctionnalites/documents/ChoixFichiers";
import { VISIBILITES } from "@/fonctionnalites/documents/partage";
import { creerMandatPasse } from "./actions";

const champ = "min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";
const NOUVEAU = "nouveau";

/**
 * Import d'anciens dossiers (avant la plateforme) par le bureau : un mandat (existant, ou un mandat passé
 * créé pour l'occasion), une délégation et un partage communs, puis les fichiers d'un coup.
 */
export function ImportArchives({ mandats, delegations }: { mandats: { id: string; libelle: string }[]; delegations: { id: string; nom: string }[] }) {
  const [mandat, setMandat] = useState(mandats[0]?.id ?? NOUVEAU);
  const [libelle, setLibelle] = useState("");
  const [delegationId, setDelegationId] = useState("");
  const [visibilite, setVisibilite] = useState("section");

  async function champs(): Promise<Record<string, string> | string> {
    let mandatId = mandat;
    if (mandat === NOUVEAU) {
      const f = new FormData();
      f.set("libelle", libelle);
      const r = await creerMandatPasse({}, f);
      if (!r.mandatId) return r.erreur ?? "Mandat impossible à créer.";
      mandatId = r.mandatId;
    }
    return { mandatId, delegationId, visibilite };
  }

  return (
    <div className="flex flex-col gap-5 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-mandat" className="font-semibold">
            Mandat
          </label>
          <select id="import-mandat" value={mandat} onChange={(e) => setMandat(e.target.value)} className={champ}>
            {mandats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.libelle}
              </option>
            ))}
            <option value={NOUVEAU}>Un mandat plus ancien…</option>
          </select>
        </div>
        {mandat === NOUVEAU && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="import-libelle" className="font-semibold">
              Nom de ce mandat
            </label>
            <input id="import-libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="2023-2024" maxLength={40} className={champ} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-delegation" className="font-semibold">
            Délégation
          </label>
          <select id="import-delegation" value={delegationId} onChange={(e) => setDelegationId(e.target.value)} className={champ}>
            <option value="">Bureau exécutif</option>
            {delegations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-visibilite" className="font-semibold">
            Qui les voit
          </label>
          <select id="import-visibilite" value={visibilite} onChange={(e) => setVisibilite(e.target.value)} className={champ}>
            {VISIBILITES.filter((v) => delegationId || v.valeur !== "delegation").map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.libelle === "Ma délégation" ? "La délégation choisie" : v.libelle}
              </option>
            ))}
          </select>
        </div>
      </div>
      <ChoixFichiers id="import-fichiers" libelle="Choisir les fichiers (PDF, images)" accept="image/*,application/pdf" champs={champs} />
      <p className="m-0 text-sm text-encre-douce">20 Mo au plus par fichier. Les fichiers sont rangés en lecture seule dans le mandat choisi s&apos;il est clos.</p>
    </div>
  );
}
