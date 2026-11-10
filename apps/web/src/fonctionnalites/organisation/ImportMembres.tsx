"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Check, Copy, Download, FileCheck2, MailCheck, MessageCircle, Upload } from "lucide-react";
import { lienCsv } from "@/fonctionnalites/csv";
import { importerMembres, type EtatImport } from "./actions";
import { MessageErreur } from "./ChampsPoste";
import type { LigneAnalysee, MembreImporte, SuiteImport } from "./gestion";
import { MAX_LIGNES_IMPORT, MODELE_IMPORT } from "./import-membres";
import { messageActivation, useAdresseActivation } from "./LienActivation";
import { LIBELLES_ROLES } from "./roles";
import { coordonnee, lienWhatsApp } from "./telephone";

const SUITES: Record<SuiteImport, string> = {
  nouveau: "Nouveau compte",
  reaffecte: "Ancien membre, réaffecté",
  deja: "Déjà dans le mandat : ignoré",
};

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Import du bureau depuis un fichier CSV : vérification ligne par ligne (rien n'est enregistré), puis import
 * en une fois et liens d'activation à transmettre.
 */
export function ImportMembres() {
  const [etat, envoyer, enCours] = useActionState<EtatImport, FormData>(importerMembres, {});
  // Un autre fichier choisi : le contrôle affiché ne le concerne plus.
  const [fichierChange, setFichierChange] = useState(false);
  const analyse = fichierChange ? undefined : etat.analyse;
  const aImporter = analyse?.lignes.filter((l) => l.suite && l.suite !== "deja").length ?? 0;

  // Envoi à la main : un formulaire à action est vidé après l'envoi, or le fichier vérifié doit rester pour l'import.
  function soumettre(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const donnees = new FormData(ev.currentTarget, (ev.nativeEvent as SubmitEvent).submitter);
    setFichierChange(false);
    startTransition(() => envoyer(donnees));
  }

  return (
    <div className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <div className="flex flex-col gap-1">
        <h3 className="titre-3 m-0">Importer depuis un fichier</h3>
        <p id="aide-import" className="m-0 text-sm leading-5 text-encre-douce">
          Tout le bureau en une fois : un fichier CSV (Excel : Enregistrer sous › CSV), une ligne par membre, {MAX_LIGNES_IMPORT} au plus. Colonnes : nom, email
          (à défaut telephone : le membre reçoit son lien sur WhatsApp et donne son e-mail en activant son compte), role (Président, Vice-président, Secrétaire général, Responsable ou Membre ; vide : Membre), delegation (sauf bureau exécutif), code de la délégation et
          designer (« oui ») facultatifs. Les délégations absentes sont créées.
        </p>
      </div>
      <a href={lienCsv(MODELE_IMPORT)} download="membres-modele.csv" className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
        <Download size={16} aria-hidden />
        Télécharger un fichier modèle
      </a>
      <form onSubmit={soumettre} className="flex flex-col gap-4" aria-describedby="aide-import">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="import-fichier" className="text-sm font-semibold">
            Fichier des membres
          </label>
          <input
            id="import-fichier"
            name="fichier"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={() => setFichierChange(true)}
            aria-invalid={etat.erreur ? true : undefined}
            aria-describedby={etat.erreur ? "erreur-import" : undefined}
            className="text-base file:mr-3 file:min-h-11 file:rounded-m file:border file:border-vert-esatic file:bg-transparent file:px-4 file:font-semibold file:text-vert-esatic"
          />
        </div>
        <MessageErreur id="erreur-import" erreur={etat.erreur} />

        {analyse && <Controle lignes={analyse.lignes} nouvelles={analyse.nouvellesDelegations} valide={analyse.valide} />}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="intention"
            value="verifier"
            disabled={enCours}
            className={`flex min-h-11 items-center gap-2 rounded-m px-5 font-semibold disabled:opacity-70 ${
              analyse?.valide && aImporter ? "border border-vert-esatic text-vert-esatic" : "bg-vert-esatic text-sur-vert"
            }`}
          >
            <FileCheck2 size={18} aria-hidden />
            {enCours ? "Lecture…" : analyse ? "Vérifier à nouveau" : "Vérifier le fichier"}
          </button>
          {analyse?.valide && aImporter > 0 && (
            <button type="submit" name="intention" value="importer" disabled={enCours} className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70">
              <Upload size={18} aria-hidden />
              {enCours ? "Import…" : `Importer ${pluriel(aImporter, "membre")}`}
            </button>
          )}
        </div>
      </form>
      {etat.importes && <Resultat importes={etat.importes} />}
    </div>
  );
}

/** Ce que l'import fera, ligne par ligne, avec les erreurs à corriger dans le fichier. */
function Controle({ lignes, nouvelles, valide }: { lignes: LigneAnalysee[]; nouvelles: { nom: string; code: string | null }[]; valide: boolean }) {
  const nb = (s: SuiteImport) => lignes.filter((l) => l.suite === s).length;
  const enErreur = lignes.filter((l) => l.erreurs.length).length;
  const bilan = [
    nb("nouveau") && `${nb("nouveau")} nouveau${nb("nouveau") > 1 ? "x comptes" : " compte"}`,
    nb("reaffecte") && `${pluriel(nb("reaffecte"), "ancien membre")} réaffecté${nb("reaffecte") > 1 ? "s" : ""}`,
    nb("deja") && `${nb("deja")} déjà dans le mandat (ignoré${nb("deja") > 1 ? "s" : ""})`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3" role="status">
      {valide ? (
        <p className="m-0 rounded-m bg-fond-succes p-3 text-sm leading-5">
          <strong>Fichier correct.</strong> {bilan.join(", ")}.
          {nouvelles.length > 0 && <> Délégations créées : {nouvelles.map((d) => (d.code ? `${d.nom} (${d.code})` : d.nom)).join(", ")}.</>} Rien n&apos;est enregistré tant que
          tu n&apos;as pas cliqué sur « Importer ».
        </p>
      ) : (
        <p className="m-0 rounded-m bg-fond-danger p-3 text-sm leading-5 text-danger">
          <strong>{pluriel(enErreur, "ligne")} à corriger</strong> dans ton fichier, puis vérifie-le à nouveau. Rien n&apos;est importé tant qu&apos;il reste une erreur.
        </p>
      )}
      <ul className="m-0 flex max-h-[420px] list-none flex-col overflow-y-auto rounded-m border border-trait p-0">
        {lignes.map((l) => (
          <li key={l.ligne} className="flex flex-col gap-0.5 border-b border-trait px-3 py-2 text-sm last:border-b-0">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-encre-douce">Ligne {l.ligne}</span>
              <span className="font-semibold">{l.nom || "—"}</span>
              <span className="break-all text-encre-douce">{l.email || l.telephone ? coordonnee(l.email, l.telephone) : ""}</span>
            </div>
            <div className="text-encre-douce">
              {l.role ? LIBELLES_ROLES[l.role] : "Rôle ?"}
              {l.delegation && ` · ${l.delegation}`}
              {l.code && ` (${l.code})`}
              {l.designer && " · designer"}
            </div>
            {l.erreurs.length ? (
              <ul className="m-0 list-none p-0 text-danger">
                {l.erreurs.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : (
              l.suite && <span className={l.suite === "deja" ? "text-encre-douce" : "text-succes"}>{SUITES[l.suite]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Liens d'activation des membres importés. Ceux partis par e-mail sont seulement signalés ; les autres
 * (adresse d'envoi non configurée, envoi raté) sont affichés une seule fois, à transmettre en privé.
 */
function Resultat({ importes }: { importes: MembreImporte[] }) {
  const adresse = useAdresseActivation();
  const envoyes = importes.filter((m) => m.jeton && m.envoye);
  const avecLien = importes.filter((m) => m.jeton && !m.envoye);
  const csv = `nom;email;telephone;lien\n${avecLien.map((m) => [m.nom, m.email, m.telephone ?? "", adresse(m.jeton!)].map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\n")}\n`;
  const ajoutes = importes.filter((m) => m.suite !== "deja").length;

  return (
    <div role="status" className="flex flex-col gap-3 rounded-m border border-vert-esatic bg-fond-succes p-4">
      <p className="m-0 text-sm leading-5">
        <strong>{pluriel(ajoutes, "membre")} ajouté{ajoutes > 1 ? "s" : ""} au mandat.</strong>{" "}
        {envoyes.length > 0 &&
          `${envoyes.length > 1 ? `${envoyes.length} liens d'activation sont partis` : "1 lien d'activation est parti"} par e-mail : chacun choisit son mot de passe depuis sa boîte (pense aux courriers indésirables). `}
        {avecLien.length > 0
          ? `${
              envoyes.length === 0
                ? "Transmets à chacun son lien"
                : avecLien.length > 1
                  ? `${avecLien.length} liens n'ont pas pu partir : transmets-les`
                  : "1 lien n'a pas pu partir : transmets-le"
            }, en privé : il sert une seule fois, pendant 7 jours, et ne sera plus affiché ici (tu pourras en générer un autre depuis la liste des membres). Ne partage pas ces liens dans un groupe.`
          : envoyes.length === 0 && "Leurs comptes sont déjà actifs : ils se connectent avec leur mot de passe habituel."}
      </p>
      {envoyes.length > 0 && (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
            <MailCheck size={16} aria-hidden />
            Envoyés par e-mail ({envoyes.length})
          </summary>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 pl-6">
            {envoyes.map((m) => (
              <li key={m.email} className="break-all">
                <span className="font-semibold">{m.nom}</span> <span className="text-encre-douce">{m.email}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {avecLien.length > 0 && (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {avecLien.map((m) => (
              <LigneLien key={m.email || m.telephone} membre={m} adresse={adresse(m.jeton!)} />
            ))}
          </ul>
          <a href={lienCsv(csv)} download="liens-activation.csv" className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
            <Download size={16} aria-hidden />
            Télécharger les liens (CSV)
          </a>
        </>
      )}
    </div>
  );
}

function LigneLien({ membre, adresse }: { membre: MembreImporte; adresse: string }) {
  const [copie, setCopie] = useState(false);
  const message = messageActivation(membre.nom, adresse);
  async function copier() {
    try {
      await navigator.clipboard.writeText(message);
      setCopie(true);
    } catch {
      // Presse-papiers refusé : le fichier des liens reste disponible.
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-m bg-surface-relevee px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="font-semibold">{membre.nom}</span>
        <span className="text-sm break-all text-encre-douce">{coordonnee(membre.email, membre.telephone)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copier} className="flex min-h-11 items-center gap-2 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre">
          {copie ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copie ? "Copié" : "Copier le message"}
        </button>
        <a
          href={lienWhatsApp(membre.telephone, message)}
          target="_blank"
          rel="noreferrer"
          aria-label={`Envoyer le lien de ${membre.nom} par WhatsApp`}
          className="flex min-h-11 items-center gap-2 rounded-m border border-trait-champ px-3 text-sm font-semibold text-encre no-underline"
        >
          <MessageCircle size={16} aria-hidden />
          WhatsApp
        </a>
      </div>
    </li>
  );
}
