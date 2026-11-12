"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import * as gestion from "./gestion";
import * as organigramme from "./organigramme";
import { ErreurOrganigramme, lireOrganigramme } from "./organigramme-csv";
import { mandatCourant } from "@/fonctionnalites/organisation/requetes";

export interface EtatActivite {
  erreur?: string;
  ok?: boolean;
  /** Compte rendu d'un import. */
  message?: string;
}

const lire = (f: FormData, nom: string) => (typeof f.get(nom) === "string" ? String(f.get(nom)) : "");
const Id = z.uuid();
const Visibilite = z.enum(["bureau", "delegation", "section"]).optional().catch(undefined);

async function executer(op: () => Promise<void>): Promise<EtatActivite | null> {
  try {
    await op();
    return null;
  } catch (e) {
    if (e instanceof ErreurSaisie) return { erreur: e.message };
    if (e instanceof z.ZodError) return { erreur: "Saisie invalide." };
    throw e;
  }
}

/** Crée (sans `id`) ou modifie une activité ; la création mène à sa fiche. */
export async function enregistrerActivite(_e: EtatActivite, f: FormData): Promise<EtatActivite> {
  const u = await exigerUtilisateur();
  const saisie: gestion.SaisieActivite = {
    titre: lire(f, "titre"),
    date: lire(f, "date"),
    heure: lire(f, "heure"),
    lieu: lire(f, "lieu"),
    description: lire(f, "description"),
    bilan: f.has("bilan") ? lire(f, "bilan") : undefined,
    visibilite: Visibilite.parse(lire(f, "visibilite") || undefined),
    delegationId: f.has("delegationId") ? lire(f, "delegationId") || null : undefined,
  };
  const id = lire(f, "id");
  let cree = "";
  const echec = await executer(async () => {
    if (id) {
      await gestion.modifierActivite(u, Id.parse(id), saisie);
    } else cree = (await gestion.creerActivite(u, saisie)).id;
  });
  if (echec) return echec;
  revalidatePath("/activites");
  if (cree) redirect(`/activites/${cree}`);
  revalidatePath(`/activites/${id}`);
  return { ok: true };
}

export async function supprimerActivite(_e: EtatActivite, f: FormData): Promise<EtatActivite> {
  const u = await exigerUtilisateur();
  const echec = await executer(() => gestion.supprimerActivite(u, Id.parse(lire(f, "id"))));
  if (echec) return echec;
  revalidatePath("/activites");
  redirect("/activites");
}

/** Comité d'organisation : `operation` = pco | adjoint (nommer, `userId` vide pour personne), ajouter, retirer. */
export async function modifierComite(_e: EtatActivite, f: FormData): Promise<EtatActivite> {
  const u = await exigerUtilisateur();
  const activiteId = lire(f, "activiteId");
  const userId = lire(f, "userId").slice(0, 64);
  const operation = lire(f, "operation");
  const echec = await executer(async () => {
    const id = Id.parse(activiteId);
    if (operation === "pco" || operation === "adjoint") await gestion.nommerAuComite(u, id, operation, userId || null);
    else if (!userId) throw new ErreurSaisie("Choisis un membre.");
    else if (operation === "ajouter") await gestion.ajouterAuComite(u, id, userId);
    else if (operation === "retirer") await gestion.retirerDuComite(u, id, userId);
    else throw new ErreurSaisie("Action inconnue.");
  });
  if (echec) return echec;
  revalidatePath(`/activites/${activiteId}`);
  revalidatePath("/activites");
  return { ok: true };
}

/** Rattache un document à l'activité (`activiteId`), ou le détache (`activiteId` vide). */
export async function rattacherDocument(_e: EtatActivite, f: FormData): Promise<EtatActivite> {
  const u = await exigerUtilisateur();
  const documentId = lire(f, "documentId");
  const activiteId = lire(f, "activiteId") || null;
  const echec = await executer(() => gestion.rattacherDocument(u, Id.parse(documentId), activiteId ? Id.parse(activiteId) : null));
  if (echec) return echec;
  revalidatePath(`/documents/${documentId}`);
  if (activiteId) revalidatePath(`/activites/${activiteId}`);
  const precedente = lire(f, "precedente");
  if (precedente) revalidatePath(`/activites/${precedente}`);
  return { ok: true };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Import CSV de l'organigramme : commissions de l'activité (`activiteId`), ou équipes du mandat en cours (sans). */
export async function importerOrganigramme(_e: EtatActivite, f: FormData): Promise<EtatActivite> {
  const u = await exigerUtilisateur();
  const activiteId = lire(f, "activiteId");
  const fichier = f.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisis le fichier CSV." };
  let bilan = { commissions: 0, personnes: 0 };
  const echec = await executer(async () => {
    let lignes;
    try {
      lignes = lireOrganigramme(new Uint8Array(await fichier.arrayBuffer()));
    } catch (e) {
      if (e instanceof ErreurOrganigramme) throw new ErreurSaisie(e.message);
      throw e;
    }
    if (activiteId) bilan = await organigramme.importerCommissions(u, Id.parse(activiteId), lignes);
    else {
      const m = await mandatCourant();
      if (!m) throw new ErreurSaisie("Aucun mandat en cours.");
      bilan = await organigramme.importerEquipesDuMandat(u, m.id, lignes);
    }
  });
  if (echec) return echec;
  revalidatePath(activiteId ? `/activites/${activiteId}` : "/activites/equipes");
  const quoi = pluriel(bilan.commissions, activiteId ? "commission" : "équipe");
  return { ok: true, message: `Import réussi : ${quoi}, ${pluriel(bilan.personnes, "personne")}.` };
}

/** Retouches de l'organigramme : `operation` = creer, retirer-equipe, reprendre, ajouter-personne, retirer-personne, supprimer-equipe. */
export async function modifierOrganigramme(_e: EtatActivite, f: FormData): Promise<EtatActivite> {
  const u = await exigerUtilisateur();
  const activiteId = lire(f, "activiteId");
  const operation = lire(f, "operation");
  const echec = await executer(async () => {
    const equipeId = () => Id.parse(lire(f, "equipeId"));
    const activite = () => Id.parse(activiteId);
    if (operation === "creer") await organigramme.creerCommission(u, activite(), lire(f, "nom"));
    else if (operation === "retirer-equipe") await organigramme.retirerEquipe(u, activite(), equipeId());
    else if (operation === "reprendre") await organigramme.reprendreEquipe(u, activite(), equipeId());
    else if (operation === "ajouter-personne") await organigramme.ajouterPersonne(u, equipeId(), { nom: lire(f, "nom"), role: lire(f, "role"), telephone: lire(f, "telephone") });
    else if (operation === "retirer-personne") await organigramme.retirerPersonne(u, Id.parse(lire(f, "personneId")));
    else if (operation === "supprimer-equipe") await organigramme.supprimerEquipeDuMandat(u, equipeId());
    else throw new ErreurSaisie("Action inconnue.");
  });
  if (echec) return echec;
  if (activiteId) revalidatePath(`/activites/${activiteId}`);
  revalidatePath("/activites/equipes");
  return { ok: true };
}
