"use client";

import { useActionState } from "react";
import { Link2, Trash2, Unlink } from "lucide-react";
import { rattacherDocument, supprimerActivite, type EtatActivite } from "./actions";

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";

function Erreur({ etat }: { etat: EtatActivite }) {
  return etat.erreur ? (
    <p role="alert" className="m-0 rounded-m bg-fond-danger p-2 text-sm text-danger">
      {etat.erreur}
    </p>
  ) : null;
}

/** Rattache à l'activité un document existant du même mandat. */
export function RattacherDocument({ activiteId, candidats }: { activiteId: string; candidats: { id: string; titre: string }[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(rattacherDocument, {});
  if (!candidats.length) return null;
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="activiteId" value={activiteId} />
      <label htmlFor="rattacher-document" className="text-sm font-semibold">
        Rattacher un document existant
      </label>
      <div className="flex flex-wrap gap-2">
        <select id="rattacher-document" name="documentId" required className="min-h-11 min-w-0 flex-1 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre">
          {candidats.map((d) => (
            <option key={d.id} value={d.id}>
              {d.titre}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enCours} className={bouton}>
          <Link2 size={16} aria-hidden />
          Rattacher
        </button>
      </div>
      <Erreur etat={etat} />
    </form>
  );
}

export function DetacherDocument({ documentId, activiteId }: { documentId: string; activiteId: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(rattacherDocument, {});
  return (
    <form action={envoyer} className="flex flex-col gap-1">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="activiteId" value="" />
      <input type="hidden" name="precedente" value={activiteId} />
      <button type="submit" disabled={enCours} className={bouton + " self-start"}>
        <Unlink size={16} aria-hidden />
        Détacher
      </button>
      <Erreur etat={etat} />
    </form>
  );
}

export function SupprimerActivite({ id }: { id: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(supprimerActivite, {});
  return (
    <form
      action={envoyer}
      onSubmit={(e) => {
        if (!confirm("Supprimer cette activité ? Ses documents et photos restent dans Documents, sans rattachement.")) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={enCours} className={bouton + " self-start text-danger"}>
        <Trash2 size={16} aria-hidden />
        Supprimer l&apos;activité
      </button>
      <Erreur etat={etat} />
    </form>
  );
}
