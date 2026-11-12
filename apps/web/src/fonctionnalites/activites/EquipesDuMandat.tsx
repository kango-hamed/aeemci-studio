"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { modifierOrganigramme, type EtatActivite } from "./actions";
import type { EquipeDuMandat } from "./organigramme";
import { AjoutPersonne, Erreur, ImportOrganigramme, Personne } from "./OrganigrammeActivite";

function CarteEquipeDuMandat({ q }: { q: EquipeDuMandat }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierOrganigramme, {});
  return (
    <li className="flex flex-col gap-2 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
      <h2 className="titre-3 m-0 break-words">{q.nom}</h2>
      <p className="m-0 text-sm text-encre-douce">
        {q.activites.length ? (
          <>
            Reprise dans :{" "}
            {q.activites.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ", "}
                <Link href={`/activites/${a.id}`}>{a.titre}</Link>
              </span>
            ))}
          </>
        ) : (
          "Reprise dans aucune activité."
        )}
      </p>
      {q.membres.length ? (
        <ul className="m-0 list-none p-0">
          {q.membres.map((p) => (
            <Personne key={p.id} p={p} retirable />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-encre-douce">Personne pour l&apos;instant.</p>
      )}
      <AjoutPersonne equipeId={q.id} />
      <form
        action={envoyer}
        onSubmit={(ev) => {
          if (!confirm(`Supprimer l'équipe « ${q.nom} » ? Elle disparaît aussi des activités qui l'ont reprise.`)) ev.preventDefault();
        }}
        className="mt-auto flex flex-col gap-1"
      >
        <input type="hidden" name="operation" value="supprimer-equipe" />
        <input type="hidden" name="equipeId" value={q.id} />
        <button type="submit" disabled={enCours} className="flex min-h-11 items-center gap-1.5 self-start rounded-m border border-trait-champ px-3 text-sm font-semibold text-danger disabled:opacity-60">
          <Trash2 size={16} aria-hidden />
          Supprimer l&apos;équipe
        </button>
        <Erreur etat={etat} />
      </form>
    </li>
  );
}

/** Équipes du mandat (« Communication »…), gérées par les PCO et reprises dans plusieurs activités. */
export function EquipesDuMandat({ equipes }: { equipes: EquipeDuMandat[] }) {
  return (
    <>
      <div className="rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
        <ImportOrganigramme />
      </div>
      {equipes.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
          {equipes.map((q) => (
            <CarteEquipeDuMandat key={q.id} q={q} />
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">Aucune équipe pour l&apos;instant : importe-les depuis un fichier.</p>
      )}
    </>
  );
}
