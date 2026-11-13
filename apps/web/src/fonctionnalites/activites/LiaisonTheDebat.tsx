"use client";

import { useActionState } from "react";
import { ExternalLink, FileText, Link2, RefreshCw, Unlink } from "lucide-react";
import { modifierTheDebat, type EtatActivite } from "./actions";
import { themesDebattus, type EditionTheDebat, type ResultatsTheDebat } from "./the-debat-bilan";

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";

function Retour({ etat }: { etat: EtatActivite }) {
  if (etat.erreur)
    return (
      <p role="alert" className="m-0 rounded-m bg-fond-danger p-2 text-sm text-danger">
        {etat.erreur}
      </p>
    );
  return etat.ok && etat.message ? (
    <p role="status" className="m-0 rounded-m bg-fond-succes p-2 text-sm">
      {etat.message}
    </p>
  ) : null;
}

function Operation({ activiteId, operation, children, confirmer }: { activiteId: string; operation: string; children: React.ReactNode; confirmer?: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierTheDebat, {});
  return (
    <form
      action={envoyer}
      onSubmit={(e) => {
        if (confirmer && !confirm(confirmer)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="activiteId" value={activiteId} />
      <input type="hidden" name="operation" value={operation} />
      <button type="submit" disabled={enCours} className={bouton}>
        {children}
      </button>
      <Retour etat={etat} />
    </form>
  );
}

function ChoixEdition({ activiteId, editions }: { activiteId: string; editions: EditionTheDebat[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierTheDebat, {});
  if (!editions.length) return <p className="m-0 text-sm text-encre-douce">Aucune édition sur la plateforme Thé Débat pour l&apos;instant.</p>;
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="activiteId" value={activiteId} />
      <input type="hidden" name="operation" value="lier" />
      <label htmlFor="edition-the-debat" className="text-sm font-semibold">
        Édition de Thé Débat liée à cette activité
      </label>
      <div className="flex flex-wrap gap-2">
        <select id="edition-the-debat" name="editionId" required defaultValue="" className="min-h-11 min-w-0 flex-1 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre">
          <option value="" disabled>
            Choisir une édition…
          </option>
          {editions.map((e) => (
            <option key={e.id} value={e.id}>
              {e.titre}
              {e.date ? ` · ${new Date(e.date).toLocaleDateString("fr-FR", { timeZone: "UTC" })}` : ""}
            </option>
          ))}
        </select>
        <button type="submit" disabled={enCours} className={bouton}>
          <Link2 size={16} aria-hidden />
          {enCours ? "Récupération…" : "Lier et récupérer"}
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="flex min-w-[120px] flex-1 flex-col rounded-l bg-creme px-4 py-3">
      <span className="text-2xl font-bold text-vert-esatic">{valeur}</span>
      <span className="text-sm text-encre-douce">{libelle}</span>
    </div>
  );
}

/**
 * Résultats de la plateforme Thé Débat sur la fiche : chiffres, vote, thèmes débattus. Ceux qui modifient
 * l'activité lient l'édition, mettent à jour les résultats et les reportent dans le bilan.
 */
export function LiaisonTheDebat(p: {
  activiteId: string;
  resultats: ResultatsTheDebat | null;
  recupereLe: string | null;
  gerer: boolean;
  urlSite: string | null;
  editions: EditionTheDebat[] | null;
  erreurEditions: string | null;
}) {
  const r = p.resultats;
  const themes = r ? themesDebattus(r) : [];
  return (
    <section aria-labelledby="titre-the-debat" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titre-the-debat" className="titre-2 m-0">
          Thé Débat
        </h2>
        {p.urlSite && (
          <a href={p.urlSite} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1.5 font-semibold">
            Ouvrir la plateforme
            <ExternalLink size={16} aria-hidden />
          </a>
        )}
      </div>

      {r ? (
        <>
          <p className="m-0 text-sm text-encre-douce">
            Édition « {r.edition.titre} »{p.recupereLe ? ` · résultats du ${new Date(p.recupereLe).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Abidjan" })}` : ""}
          </p>
          <div className="flex flex-wrap gap-3">
            <Chiffre valeur={r.presence.presents} libelle={r.presence.presents > 1 ? "présents" : "présent"} />
            <Chiffre valeur={r.vote.votants} libelle={r.vote.votants > 1 ? "votants" : "votant"} />
            <Chiffre valeur={r.inscriptions.validees} libelle={r.inscriptions.validees > 1 ? "débatteurs" : "débatteur"} />
          </div>
          {r.vote.themes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="titre-3 m-0">Vote des thèmes</h3>
              <ol className="m-0 flex list-none flex-col gap-1 p-0">
                {r.vote.themes.map((t) => (
                  <li key={t.titre} className="flex items-baseline justify-between gap-3 border-b border-trait py-1.5 last:border-b-0">
                    <span className="min-w-0 break-words">
                      {t.titre}
                      {t.retenu && <span className="ml-2 rounded-full bg-fond-succes px-2 py-0.5 text-xs font-semibold">Retenu</span>}
                    </span>
                    <span className="shrink-0 text-sm text-encre-douce">{t.voix} voix</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {themes.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="titre-3 m-0">Thèmes débattus</h3>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3 p-0">
                {themes.map((t) => (
                  <li key={t.titre} className="flex flex-col gap-1 rounded-l border border-trait bg-surface-relevee p-4">
                    <span className="font-semibold break-words">{t.titre}</span>
                    <span className="text-sm">
                      <b>Pour :</b> {t.pour.join(", ") || "personne"}
                    </span>
                    <span className="text-sm">
                      <b>Contre :</b> {t.contre.join(", ") || "personne"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.gerer && (
            <div className="flex flex-wrap items-start gap-2">
              <Operation activiteId={p.activiteId} operation="recuperer">
                <RefreshCw size={16} aria-hidden />
                Mettre à jour les résultats
              </Operation>
              <Operation activiteId={p.activiteId} operation="inserer" confirmer="Ajouter au bilan de l'activité le texte tiré de ces résultats ? Il vient à la suite de ce qui est déjà écrit.">
                <FileText size={16} aria-hidden />
                Reporter dans le bilan
              </Operation>
              <Operation activiteId={p.activiteId} operation="lier" confirmer="Défaire la liaison avec cette édition ? Les résultats récupérés sont retirés de la fiche (le bilan déjà écrit reste).">
                <Unlink size={16} aria-hidden />
                Délier
              </Operation>
            </div>
          )}
        </>
      ) : p.erreurEditions ? (
        <p role="alert" className="m-0 rounded-m bg-fond-danger p-2 text-sm text-danger">
          {p.erreurEditions}
        </p>
      ) : (
        p.editions && (
          <>
            <p className="m-0 max-w-[680px] text-encre-douce">Lie cette activité à son édition sur la plateforme Thé Débat : les chiffres de participation, le vote et les débatteurs s&apos;affichent ici et se reportent dans le bilan.</p>
            <ChoixEdition activiteId={p.activiteId} editions={p.editions} />
          </>
        )
      )}
    </section>
  );
}
