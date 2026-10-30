"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { archiverDelegation, creerDelegation, renommerDelegation, type EtatAction } from "./actions";
import { champ, MessageErreur } from "./ChampsPoste";
import type { Delegation } from "./requetes";

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";

function LigneDelegation({ d }: { d: Delegation }) {
  const [edition, setEdition] = useState(false);
  const [etatNom, envoyerNom, nomEnCours] = useActionState<EtatAction, FormData>(async (e, f) => {
    const r = await renommerDelegation(e, f);
    if (r.ok) setEdition(false);
    return r;
  }, {});
  const [etatArchive, envoyerArchive, archiveEnCours] = useActionState<EtatAction, FormData>(archiverDelegation, {});
  const erreur = etatNom.erreur ?? etatArchive.erreur;
  const idErreur = `erreur-delegation-${d.id}`;

  return (
    <li className="flex flex-col gap-2 border-b border-trait py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {edition ? (
          <form action={envoyerNom} className="flex flex-1 flex-wrap items-center gap-2" aria-describedby={erreur ? idErreur : undefined}>
            <input type="hidden" name="id" value={d.id} />
            <label htmlFor={`nom-${d.id}`} className="sr-only">
              Nouveau nom de la délégation
            </label>
            <input id={`nom-${d.id}`} name="nom" defaultValue={d.nom} required className={champ + " min-w-[200px] flex-1"} />
            <button type="submit" disabled={nomEnCours} className="flex min-h-11 items-center rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
              Enregistrer
            </button>
            <button type="button" className={bouton} onClick={() => setEdition(false)}>
              Annuler
            </button>
          </form>
        ) : (
          <span className="flex min-w-[200px] flex-1 flex-col">
            <span className={d.archivee ? "text-encre-douce" : "font-semibold"}>
              {d.nom}
              {d.archivee && " (archivée)"}
            </span>
            <span className="text-sm text-encre-douce">{d.membres > 1 ? `${d.membres} membres` : d.membres === 1 ? "1 membre" : "Aucun membre"} dans le mandat</span>
          </span>
        )}
        {!edition && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={bouton} onClick={() => setEdition(true)}>
              <Pencil size={16} aria-hidden />
              Renommer
            </button>
            <form action={envoyerArchive}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="archivee" value={d.archivee ? "0" : "1"} />
              <button type="submit" disabled={archiveEnCours} className={bouton}>
                {d.archivee ? <ArchiveRestore size={16} aria-hidden /> : <Archive size={16} aria-hidden />}
                {d.archivee ? "Ressortir" : "Archiver"}
              </button>
            </form>
          </div>
        )}
      </div>
      <MessageErreur id={idErreur} erreur={erreur} />
    </li>
  );
}

export function GestionDelegations({ delegations }: { delegations: Delegation[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatAction, FormData>(creerDelegation, {});
  const formulaire = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (etat.ok) formulaire.current?.reset();
  }, [etat]);

  return (
    <div className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <form ref={formulaire} action={envoyer} className="flex flex-wrap items-end gap-3" aria-describedby={etat.erreur ? "erreur-delegation" : undefined}>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="delegation-nom" className="text-sm font-semibold">
            Nouvelle délégation
          </label>
          <input id="delegation-nom" name="nom" required placeholder="Cellule communication" className={champ} />
        </div>
        <button type="submit" disabled={enCours} className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
          <Plus size={18} aria-hidden />
          Créer
        </button>
      </form>
      <MessageErreur id="erreur-delegation" erreur={etat.erreur} />
      {delegations.length ? (
        <ul className="m-0 list-none p-0">
          {delegations.map((d) => (
            <LigneDelegation key={d.id} d={d} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-encre-douce">Aucune délégation pour l&apos;instant. Les rôles du bureau exécutif n&apos;en ont pas besoin.</p>
      )}
    </div>
  );
}
