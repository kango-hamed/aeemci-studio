"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Download, FileArchive, FileDown, MessageCircle, Plus, Trash2, Upload, X } from "lucide-react";
import { lienCsv } from "@/fonctionnalites/csv";
import { lienWhatsApp, numeroAffiche } from "@/fonctionnalites/organisation/telephone";
import { importerOrganigramme, modifierOrganigramme, type EtatActivite } from "./actions";
import { LIBELLES_ROLES_EQUIPE, MAX_LIGNES_ORGANIGRAMME, MODELE_ORGANIGRAMME } from "./organigramme-csv";
import type { EquipeOrganigramme, Organigramme as DonneesOrganigramme, PersonneEquipe } from "./organigramme";

const bouton = "flex min-h-11 items-center gap-1.5 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre disabled:opacity-60";
const champ = "min-h-11 min-w-0 rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

export function Erreur({ etat }: { etat: EtatActivite }) {
  return etat.erreur ? (
    <p role="alert" className="m-0 rounded-m bg-fond-danger p-2 text-sm text-danger">
      {etat.erreur}
    </p>
  ) : null;
}

/** Une personne : rôle, nom, numéro en lien WhatsApp (pour le comité), et son retrait si `retirable`. */
export function Personne({ p, retirable, activiteId }: { p: PersonneEquipe; retirable: boolean; activiteId?: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierOrganigramme, {});
  return (
    <li className="flex flex-col gap-1 border-b border-trait py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="break-words">
            {p.role !== "membre" && <span className="text-sm font-semibold text-orange-texte">{LIBELLES_ROLES_EQUIPE[p.role]} · </span>}
            <span className={p.role === "membre" ? "" : "font-semibold"}>{p.nom}</span>
          </span>
          {p.telephone && (
            <a href={lienWhatsApp(p.telephone, "")} target="_blank" rel="noreferrer" className="flex items-center gap-1 self-start text-sm">
              <MessageCircle size={14} aria-hidden />
              {numeroAffiche(p.telephone)}
            </a>
          )}
        </span>
        {retirable && (
          <form action={envoyer}>
            {activiteId && <input type="hidden" name="activiteId" value={activiteId} />}
            <input type="hidden" name="operation" value="retirer-personne" />
            <input type="hidden" name="personneId" value={p.id} />
            <button type="submit" disabled={enCours} aria-label={`Retirer ${p.nom}`} className="flex size-11 items-center justify-center rounded-m text-encre-douce disabled:opacity-60">
              <X size={18} aria-hidden />
            </button>
          </form>
        )}
      </div>
      <Erreur etat={etat} />
    </li>
  );
}

/** Ajout d'une personne à une commission ou à une équipe. */
export function AjoutPersonne({ equipeId, activiteId }: { equipeId: string; activiteId?: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierOrganigramme, {});
  const formulaire = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (etat.ok) formulaire.current?.reset();
  }, [etat]);
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-vert-esatic">
        <Plus size={16} aria-hidden />
        Ajouter une personne
      </summary>
      <form ref={formulaire} action={envoyer} className="mt-2 flex flex-col gap-2">
        {activiteId && <input type="hidden" name="activiteId" value={activiteId} />}
        <input type="hidden" name="operation" value="ajouter-personne" />
        <input type="hidden" name="equipeId" value={equipeId} />
        <label className="sr-only" htmlFor={`nom-${equipeId}`}>
          Nom
        </label>
        <input id={`nom-${equipeId}`} name="nom" required placeholder="Nom et prénoms" className={champ} />
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor={`role-${equipeId}`}>
            Rôle
          </label>
          <select id={`role-${equipeId}`} name="role" defaultValue="membre" className={champ + " flex-1"}>
            <option value="membre">Membre</option>
            <option value="responsable">Responsable</option>
            <option value="adjoint">Adjoint</option>
          </select>
          <label className="sr-only" htmlFor={`tel-${equipeId}`}>
            Numéro WhatsApp
          </label>
          <input id={`tel-${equipeId}`} name="telephone" type="tel" inputMode="tel" placeholder="Numéro (facultatif)" className={champ + " flex-1"} />
        </div>
        <button type="submit" disabled={enCours} className={bouton + " self-start"}>
          Ajouter
        </button>
        <Erreur etat={etat} />
      </form>
    </details>
  );
}

function CarteEquipe({ q, activiteId, gerer, contacts }: { q: EquipeOrganigramme; activiteId: string; gerer: boolean; contacts: boolean }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierOrganigramme, {});
  // Une équipe du mandat se modifie depuis sa page : elle sert dans d'autres activités.
  const modifiable = gerer && !q.partagee;
  return (
    <li className="flex flex-col gap-2 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
      <div className="flex items-start justify-between gap-2">
        <h3 className="titre-3 m-0 break-words">{q.nom}</h3>
        {q.partagee && <span className="shrink-0 rounded-full bg-creme px-2.5 py-0.5 text-xs font-semibold text-orange-texte">Équipe du mandat</span>}
      </div>
      {q.membres.length ? (
        <ul className="m-0 list-none p-0">
          {q.membres.map((p) => (
            <Personne key={p.id} p={p} retirable={modifiable} activiteId={activiteId} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-encre-douce">Personne pour l&apos;instant.</p>
      )}
      {modifiable && <AjoutPersonne equipeId={q.id} activiteId={activiteId} />}
      {contacts && (
        <a href={`/api/activites/${activiteId}/comite?equipe=${q.id}&telecharger`} className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold">
          <FileDown size={16} aria-hidden />
          Fiche PDF de la commission
        </a>
      )}
      {gerer && (
        <form
          action={envoyer}
          onSubmit={(ev) => {
            if (!confirm(q.partagee ? `Retirer l'équipe « ${q.nom} » de cette activité ? Elle reste dans les équipes du mandat.` : `Supprimer la commission « ${q.nom} » et ses membres ?`)) ev.preventDefault();
          }}
          className="mt-auto flex flex-col gap-1"
        >
          <input type="hidden" name="activiteId" value={activiteId} />
          <input type="hidden" name="operation" value="retirer-equipe" />
          <input type="hidden" name="equipeId" value={q.id} />
          <button type="submit" disabled={enCours} className={bouton + " self-start text-danger"}>
            <Trash2 size={16} aria-hidden />
            {q.partagee ? "Retirer de l'activité" : "Supprimer la commission"}
          </button>
          <Erreur etat={etat} />
        </form>
      )}
    </li>
  );
}

/** Import CSV : commissions de l'activité (`activiteId`) ou équipes du mandat. */
export function ImportOrganigramme({ activiteId }: { activiteId?: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(importerOrganigramme, {});
  const id = activiteId ? "import-commissions" : "import-equipes";
  return (
    <form action={envoyer} className="flex flex-col gap-2" aria-describedby={`${id}-aide`}>
      {activiteId && <input type="hidden" name="activiteId" value={activiteId} />}
      <label htmlFor={id} className="text-sm font-semibold">
        {activiteId ? "Importer les commissions" : "Importer des équipes"}
      </label>
      <p id={`${id}-aide`} className="m-0 text-sm text-encre-douce">
        Un fichier CSV, une ligne par personne ({MAX_LIGNES_ORGANIGRAMME} au plus) : commission, role (Responsable, Adjoint ou Membre ; vide : Membre), nom, telephone
        (facultatif).{" "}
        {activiteId ? "L'import remplace les commissions de l'activité ; les équipes du mandat reprises restent." : "Les équipes du fichier sont créées, ou leurs membres remplacés ; les autres ne changent pas."}
      </p>
      <a href={lienCsv(MODELE_ORGANIGRAMME)} download="commissions-modele.csv" className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
        <Download size={16} aria-hidden />
        Télécharger un fichier modèle
      </a>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={id}
          name="fichier"
          type="file"
          accept=".csv,text/csv"
          required
          className="min-w-0 flex-1 text-base file:mr-3 file:min-h-11 file:rounded-m file:border file:border-vert-esatic file:bg-transparent file:px-4 file:font-semibold file:text-vert-esatic"
        />
        <button type="submit" disabled={enCours} className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
          <Upload size={18} aria-hidden />
          {enCours ? "Import…" : "Importer"}
        </button>
      </div>
      <Erreur etat={etat} />
      {etat.ok && etat.message && (
        <p role="status" className="m-0 rounded-m bg-fond-succes p-2 text-sm">
          {etat.message}
        </p>
      )}
    </form>
  );
}

function NouvelleCommission({ activiteId }: { activiteId: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierOrganigramme, {});
  const formulaire = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (etat.ok) formulaire.current?.reset();
  }, [etat]);
  return (
    <form ref={formulaire} action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="activiteId" value={activiteId} />
      <input type="hidden" name="operation" value="creer" />
      <label htmlFor="nouvelle-commission" className="text-sm font-semibold">
        Nouvelle commission
      </label>
      <div className="flex flex-wrap gap-2">
        <input id="nouvelle-commission" name="nom" required placeholder="Logistique" className={champ + " flex-1"} />
        <button type="submit" disabled={enCours} className={bouton}>
          <Plus size={16} aria-hidden />
          Créer
        </button>
      </div>
      <Erreur etat={etat} />
    </form>
  );
}

function RepriseEquipe({ activiteId, equipes }: { activiteId: string; equipes: { id: string; nom: string }[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatActivite, FormData>(modifierOrganigramme, {});
  return (
    <form action={envoyer} className="flex flex-col gap-2">
      <input type="hidden" name="activiteId" value={activiteId} />
      <input type="hidden" name="operation" value="reprendre" />
      <label htmlFor="reprendre-equipe" className="text-sm font-semibold">
        Reprendre une équipe du mandat
      </label>
      {equipes.length ? (
        <div className="flex flex-wrap gap-2">
          <select id="reprendre-equipe" name="equipeId" required defaultValue="" className={champ + " flex-1"}>
            <option value="" disabled>
              Choisir une équipe…
            </option>
            {equipes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nom}
              </option>
            ))}
          </select>
          <button type="submit" disabled={enCours} className={bouton}>
            Reprendre
          </button>
        </div>
      ) : (
        <p className="m-0 text-sm text-encre-douce">Aucune autre équipe dans le mandat.</p>
      )}
      <Link href="/activites/equipes" className="self-start text-sm font-semibold">
        Gérer les équipes du mandat
      </Link>
      <Erreur etat={etat} />
    </form>
  );
}

/**
 * Organigramme de l'activité : le PCO et son adjoint, puis les commissions et les équipes du mandat. Les
 * numéros (liens WhatsApp) et la liste PDF ne sont montrés qu'au comité ; le PCO et l'adjoint le gèrent.
 */
export function Organigramme(p: { activiteId: string; o: DonneesOrganigramme; gerer: boolean; equipesDisponibles: { id: string; nom: string }[] }) {
  const { o } = p;
  return (
    <section aria-labelledby="titre-organigramme" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titre-organigramme" className="titre-2 m-0">
          Organigramme
        </h2>
        {o.contacts && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/activites/${p.activiteId}/comite?telecharger`} className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic no-underline">
              <FileDown size={18} aria-hidden />
              Liste PDF avec les contacts
            </a>
            {o.equipes.length > 0 && (
              <a href={`/api/activites/${p.activiteId}/comite?fiches`} className="flex min-h-11 items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic no-underline">
                <FileArchive size={18} aria-hidden />
                Une fiche par commission (zip)
              </a>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {(
          [
            ["PCO", o.pco],
            ["Adjoint du PCO", o.adjoint],
          ] as const
        ).map(([role, nom]) => (
          <div key={role} className="flex min-w-[180px] flex-1 flex-col rounded-l bg-creme px-4 py-3">
            <span className="text-sm font-semibold text-encre-douce">{role}</span>
            <span className={nom ? "font-semibold" : "text-encre-douce"}>{nom ?? "Pas encore nommé"}</span>
          </div>
        ))}
      </div>
      {o.equipes.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 p-0">
          {o.equipes.map((q) => (
            <CarteEquipe key={q.id} q={q} activiteId={p.activiteId} gerer={p.gerer} contacts={o.contacts} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-encre-douce">{p.gerer ? "Aucune commission : importe-les depuis un fichier, crée-les une à une ou reprends une équipe du mandat." : "Les commissions n'ont pas encore été constituées."}</p>
      )}
      {p.gerer && (
        <details className="rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
          <summary className="cursor-pointer font-semibold">Constituer les commissions</summary>
          <div className="mt-4 flex flex-col gap-6">
            <ImportOrganigramme activiteId={p.activiteId} />
            <NouvelleCommission activiteId={p.activiteId} />
            <RepriseEquipe activiteId={p.activiteId} equipes={p.equipesDisponibles} />
          </div>
        </details>
      )}
    </section>
  );
}
