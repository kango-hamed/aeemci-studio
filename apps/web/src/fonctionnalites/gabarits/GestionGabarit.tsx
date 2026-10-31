"use client";

import { useActionState, useState } from "react";
import { abandonnerBrouillon, modifierFiche, ouvrirBrouillon, retablirRevision, type EtatGabarit } from "./actions";

const champ = "min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

function Message({ etat, ok }: { etat: EtatGabarit; ok?: string }) {
  if (etat.erreur)
    return (
      <p role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-sm text-danger">
        {etat.erreur}
      </p>
    );
  return etat.ok && ok ? <p className="m-0 text-sm font-semibold text-succes">{ok}</p> : null;
}

/** Nom, description, activation et réservation du gabarit à certaines délégations. */
export function FicheGabarit({
  gabaritId,
  nom,
  description,
  actif,
  publie,
  delegations,
  reservees,
}: {
  gabaritId: string;
  nom: string;
  description: string | null;
  actif: boolean;
  publie: boolean;
  delegations: { id: string; nom: string }[];
  reservees: string[];
}) {
  const [etat, envoyer, enCours] = useActionState<EtatGabarit, FormData>(modifierFiche, {});
  // Champs contrôlés : React vide un formulaire après chaque action, et une saisie refusée serait perdue.
  const [valeurs, setValeurs] = useState({ nom, description: description ?? "", actif, delegations: reservees });
  const [reserve, setReserve] = useState(reservees.length > 0);
  return (
    <form action={envoyer} className="flex flex-col gap-4">
      <input type="hidden" name="gabaritId" value={gabaritId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fiche-nom" className="font-semibold">
          Nom
        </label>
        <input id="fiche-nom" name="nom" value={valeurs.nom} onChange={(e) => setValeurs((v) => ({ ...v, nom: e.target.value }))} required minLength={2} maxLength={80} className={champ} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fiche-description" className="font-semibold">
          Description (visible par les membres)
        </label>
        <textarea
          id="fiche-description"
          name="description"
          value={valeurs.description}
          onChange={(e) => setValeurs((v) => ({ ...v, description: e.target.value }))}
          maxLength={300}
          rows={2}
          placeholder="Ex. : présentation d'un panéliste, format post Instagram"
          className={champ + " py-2"}
        />
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-1.5 font-semibold">Qui peut l&apos;utiliser</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="reserve" value="0" checked={!reserve} onChange={() => setReserve(false)} className="size-5 accent-vert-esatic" />
          Toute la section
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="reserve" value="1" checked={reserve} onChange={() => setReserve(true)} className="size-5 accent-vert-esatic" />
          Certaines délégations (et le bureau exécutif)
        </label>
        {reserve && (
          <div className="ml-8 flex flex-col">
            {delegations.map((d) => (
              <label key={d.id} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  name="delegations"
                  value={d.id}
                  checked={valeurs.delegations.includes(d.id)}
                  onChange={(e) => setValeurs((v) => ({ ...v, delegations: e.target.checked ? [...v.delegations, d.id] : v.delegations.filter((x) => x !== d.id) }))}
                  className="size-5 accent-vert-esatic"
                />
                {d.nom}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="actif"
          value="1"
          checked={valeurs.actif}
          onChange={(e) => setValeurs((v) => ({ ...v, actif: e.target.checked }))}
          disabled={!publie} className="size-5 accent-vert-esatic" />
        <span>
          Proposé aux membres
          {!publie && <span className="text-encre-douce"> (après la première publication)</span>}
        </span>
      </label>
      <Message etat={etat} ok="Fiche enregistrée." />
      <button type="submit" disabled={enCours} className="flex min-h-12 items-center self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70">
        Enregistrer la fiche
      </button>
    </form>
  );
}

/** « Modifier les réglages » : ouvre un brouillon à partir de la révision publiée. */
export function OuvrirBrouillon({ gabaritId }: { gabaritId: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatGabarit, FormData>(ouvrirBrouillon, {});
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="gabaritId" value={gabaritId} />
      <button type="submit" disabled={enCours} className="flex min-h-12 items-center self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70">
        Modifier les réglages
      </button>
      <Message etat={etat} />
    </form>
  );
}

export function AbandonnerBrouillon({ gabaritId, jamaisPublie }: { gabaritId: string; jamaisPublie: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatGabarit, FormData>(abandonnerBrouillon, {});
  return (
    <form
      action={envoyer}
      onSubmit={(e) => {
        if (!confirm(jamaisPublie ? "Supprimer ce gabarit importé, jamais publié ?" : "Abandonner le brouillon ? La révision publiée reste en service.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="gabaritId" value={gabaritId} />
      <input type="hidden" name="jamaisPublie" value={jamaisPublie ? "1" : "0"} />
      <button type="submit" disabled={enCours} className="flex min-h-11 items-center rounded-m px-3 font-semibold text-danger disabled:opacity-60">
        {jamaisPublie ? "Supprimer ce gabarit" : "Abandonner le brouillon"}
      </button>
      <Message etat={etat} />
    </form>
  );
}

export function RetablirRevision({ gabaritId, revisionId, numero }: { gabaritId: string; revisionId: string; numero: number }) {
  const [etat, envoyer, enCours] = useActionState<EtatGabarit, FormData>(retablirRevision, {});
  return (
    <form action={envoyer} className="flex items-center gap-2">
      <input type="hidden" name="gabaritId" value={gabaritId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <button
        type="submit"
        disabled={enCours}
        aria-label={`Remettre en service la révision ${numero}`}
        className="flex min-h-11 items-center rounded-m border border-trait-champ px-3 text-sm font-semibold disabled:opacity-60"
      >
        Remettre en service
      </button>
      <Message etat={etat} />
    </form>
  );
}
