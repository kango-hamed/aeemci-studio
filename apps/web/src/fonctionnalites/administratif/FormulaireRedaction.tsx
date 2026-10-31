"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Download, Loader2, Save, Send } from "lucide-react";
import type { Visibilite } from "@/fonctionnalites/organisation/droits";
import { visibilitesPour } from "@/fonctionnalites/documents/partage";
import { enregistrerRedaction, type EtatCircuit } from "./actions";
import { definitionType, LONGUEUR_MAX_CHAMP, type TypeAdministratif } from "./types";
import { colonnesDe, COLONNES_ADRESSE, MAX_DESTINATAIRES, MODELE_CSV, type Destinataire } from "./envois";

const champ = "w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre aria-invalid:border-danger";

/**
 * Rédaction d'un document administratif : champs du type, titre, partage après validation.
 * Champs contrôlés : une erreur de saisie ne vide pas le formulaire.
 */
export function FormulaireRedaction(p: {
  type: TypeAdministratif;
  id?: string;
  contenu?: Record<string, string>;
  titre?: string;
  visibilite?: Visibilite;
  aUneDelegation: boolean;
  /** Message d'un refus de soumission survenu juste après la création. */
  refus?: string;
  /** Lettres en nombre : la liste enregistrée (vide au départ). */
  envoi?: { destinataires: Destinataire[] };
  /** Nouveau document créé depuis une activité. */
  activiteId?: string;
}) {
  const t = definitionType(p.type)!;
  const [etat, envoyer, enCours] = useActionState<EtatCircuit, FormData>(enregistrerRedaction, p.refus ? { erreur: p.refus } : {});
  const [contenu, setContenu] = useState<Record<string, string>>(p.contenu ?? {});
  const [titre, setTitre] = useState(p.titre ?? "");
  const [visibilite, setVisibilite] = useState<Visibilite>(p.visibilite ?? (p.aUneDelegation ? "delegation" : "bureau"));
  const erreurDe = (nom: string) => etat.erreurs?.find((x) => x.champ === nom)?.message;
  // Envoi : le bloc destinataire vient du fichier, chaque lettre a le sien.
  const champs = p.envoi ? t.champs.filter((c) => c.nom !== "destinataire") : t.champs;

  return (
    <form action={envoyer} className="flex flex-col gap-5" noValidate>
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <input type="hidden" name="type" value={p.type} />
      {!p.id && p.envoi && <input type="hidden" name="envoi" value="1" />}
      {!p.id && p.activiteId && <input type="hidden" name="activiteId" value={p.activiteId} />}
      {p.envoi && <Destinataires liste={p.envoi.destinataires} erreur={erreurDe("destinataires")} />}
      {champs.map((c) => {
        const id = `champ-${c.nom}`;
        const erreur = erreurDe(c.nom);
        const commun = {
          id,
          name: `c.${c.nom}`,
          value: contenu[c.nom] ?? "",
          onChange: (ev: { target: { value: string } }) => setContenu((x) => ({ ...x, [c.nom]: ev.target.value })),
          "aria-invalid": erreur ? true : undefined,
          "aria-describedby": [c.aide ? `${id}-aide` : "", erreur ? `${id}-erreur` : ""].filter(Boolean).join(" ") || undefined,
          maxLength: LONGUEUR_MAX_CHAMP[c.genre],
        };
        return (
          <div key={c.nom} className="flex flex-col gap-1.5">
            <label htmlFor={id} className="font-semibold">
              {c.libelle}
              {!c.requis && <span className="font-normal text-encre-douce"> (facultatif)</span>}
            </label>
            {(c.aide || (p.envoi && c.nom !== "pieces")) && (
              <p id={`${id}-aide`} className="m-0 text-sm text-encre-douce">
                {[c.aide, p.envoi && c.nom !== "pieces" ? "Variables permises : {nom}, {fonction}…, remplacées pour chaque destinataire." : ""].filter(Boolean).join(" ")}
              </p>
            )}
            {c.genre === "texte" ? (
              <textarea {...commun} rows={c.nom === "corps" || c.nom === "deroulement" ? 10 : 4} placeholder={c.exemple} className={champ + " min-h-24 py-2 leading-6"} />
            ) : (
              <input {...commun} type={c.genre === "ligne" ? "text" : c.genre === "date" ? "date" : "time"} placeholder={c.exemple} className={champ + " min-h-12"} />
            )}
            {erreur && (
              <p id={`${id}-erreur`} className="m-0 text-sm text-danger">
                {erreur}
              </p>
            )}
          </div>
        );
      })}

      <fieldset className="m-0 flex flex-col gap-4 rounded-m border border-trait p-4">
        <legend className="px-1 font-semibold">Classement</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="redaction-titre" className="text-sm font-semibold">
            Titre dans la plateforme <span className="font-normal text-encre-douce">(facultatif)</span>
          </label>
          <input id="redaction-titre" name="titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} placeholder={`${t.libelle} · …`} className={champ + " min-h-11"} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="redaction-visibilite" className="text-sm font-semibold">
            Qui le verra une fois validé
          </label>
          <select id="redaction-visibilite" name="visibilite" value={visibilite} onChange={(e) => setVisibilite(e.target.value as Visibilite)} className={champ + " min-h-11"}>
            {visibilitesPour(p.aUneDelegation).map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.libelle} : {v.detail}
              </option>
            ))}
          </select>
          <p className="m-0 text-sm text-encre-douce">Jusqu&apos;à la validation, seuls toi et le bureau exécutif le voyez.</p>
        </div>
      </fieldset>

      {etat.erreur && (
        <div role="alert" className="flex gap-3 rounded-m bg-fond-danger p-4 text-danger">
          <AlertTriangle size={20} aria-hidden className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="m-0 font-semibold">{etat.erreur}</p>
            {etat.erreurs && etat.erreurs.length > 0 && (
              <ul className="m-0 pl-5 text-sm">
                {etat.erreurs.map((x) => (
                  <li key={x.champ}>{x.message}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {etat.ok && !enCours && (
        <p role="status" className="m-0 rounded-m bg-fond-succes p-3 text-succes">
          Projet enregistré : l&apos;aperçu est à jour.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intention"
          value="enregistrer"
          disabled={enCours}
          className="flex min-h-12 items-center gap-2 rounded-m border border-vert-esatic px-5 font-semibold text-vert-esatic disabled:opacity-70"
        >
          {enCours ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Save size={18} aria-hidden />}
          Enregistrer le projet
        </button>
        <button type="submit" name="intention" value="soumettre" disabled={enCours} className="flex min-h-12 items-center gap-2 rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70">
          <Send size={18} aria-hidden />
          Soumettre à la validation
        </button>
      </div>
    </form>
  );
}

/** Liste des destinataires d'un envoi : ce qui est importé, le fichier à déposer, les variables. */
function Destinataires({ liste, erreur }: { liste: Destinataire[]; erreur?: string }) {
  const colonnes = liste.length ? colonnesDe(liste) : [...COLONNES_ADRESSE];
  const nomDe = (d: Destinataire) => [d.civilite, d.nom].filter(Boolean).join(" ") || d.organisme;
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-m border border-trait p-4" aria-describedby="destinataires-aide">
      <legend className="px-1 font-semibold">Destinataires</legend>
      {liste.length ? (
        <p className="m-0">
          <b>{liste.length} destinataire{liste.length > 1 ? "s" : ""}</b> : {liste.slice(0, 4).map(nomDe).join(", ")}
          {liste.length > 4 ? "…" : ""}
        </p>
      ) : (
        <p className="m-0 text-encre-douce">Aucune liste importée pour l&apos;instant.</p>
      )}
      <p id="destinataires-aide" className="m-0 text-sm text-encre-douce">
        Fichier CSV (Excel : Enregistrer sous › CSV), une ligne par destinataire, {MAX_DESTINATAIRES} au plus. Colonnes reconnues : civilite, nom, fonction, organisme,
        adresse ; toute autre colonne devient une variable. Un nouveau fichier remplace la liste.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="champ-destinataires" className="text-sm font-semibold">
          {liste.length ? "Remplacer la liste" : "Importer la liste"}
        </label>
        <input
          id="champ-destinataires"
          name="destinataires"
          type="file"
          accept=".csv,text/csv"
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? "champ-destinataires-erreur" : undefined}
          className="text-base file:mr-3 file:min-h-11 file:rounded-m file:border file:border-vert-esatic file:bg-transparent file:px-4 file:font-semibold file:text-vert-esatic"
        />
        {erreur && (
          <p id="champ-destinataires-erreur" className="m-0 text-sm text-danger">
            {erreur}
          </p>
        )}
      </div>
      <a
        href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + MODELE_CSV)}`}
        download="destinataires-modele.csv"
        className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold"
      >
        <Download size={16} aria-hidden />
        Télécharger un fichier modèle
      </a>
      <p className="m-0 text-sm">
        Variables : {colonnes.map((c) => <code key={c} className="mr-1.5 rounded-s bg-creme px-1.5 py-0.5">{`{${c}}`}</code>)}
      </p>
    </fieldset>
  );
}
