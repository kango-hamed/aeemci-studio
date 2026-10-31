"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import * as gestion from "./gestion";

export interface EtatActivite {
  erreur?: string;
  ok?: boolean;
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
