"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Controles, Gabarit } from "@aeemci-studio/moteur";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import * as atelier from "./atelier";

export interface EtatGabarit {
  erreur?: string;
  details?: string[];
  ok?: boolean;
  controles?: Controles;
  /** Publication : numéro de la révision mise en ligne et remarques. */
  numero?: number;
  remarques?: string[];
}

const lire = (f: FormData, nom: string) => (typeof f.get(nom) === "string" ? String(f.get(nom)) : "");

async function executer(gabaritId: string, op: (u: Awaited<ReturnType<typeof exigerUtilisateur>>) => Promise<EtatGabarit | void>): Promise<EtatGabarit> {
  const u = await exigerUtilisateur();
  try {
    const r = await op(u);
    revalidatePath(`/gabarits/${gabaritId}/reglages`);
    revalidatePath("/gabarits");
    return { ok: true, ...(r ?? {}) };
  } catch (e) {
    if (e instanceof atelier.ErreurGabarit) return { erreur: e.message, details: e.details };
    throw e;
  }
}

/** Réglages du brouillon (JSON envoyé par l'écran) ; renvoie les contrôles à jour. */
export async function enregistrerReglages(gabaritId: string, contenu: Gabarit): Promise<EtatGabarit> {
  const u = await exigerUtilisateur();
  try {
    return { ok: true, controles: await atelier.enregistrerBrouillon(u, gabaritId, contenu) };
  } catch (e) {
    if (e instanceof atelier.ErreurGabarit) return { erreur: e.message };
    throw e;
  }
}

export async function publierGabarit(gabaritId: string, contenu: Gabarit): Promise<EtatGabarit> {
  const avant = await enregistrerReglages(gabaritId, contenu);
  if (avant.erreur) return avant;
  return executer(gabaritId, (u) => atelier.publier(u, gabaritId));
}

export async function ouvrirBrouillon(_e: EtatGabarit, f: FormData): Promise<EtatGabarit> {
  return executer(lire(f, "gabaritId"), async (u) => {
    await atelier.ouvrirBrouillon(u, lire(f, "gabaritId"));
  });
}

export async function abandonnerBrouillon(_e: EtatGabarit, f: FormData): Promise<EtatGabarit> {
  const id = lire(f, "gabaritId");
  const r = await executer(id, (u) => atelier.abandonnerBrouillon(u, id));
  // Un gabarit jamais publié disparaît avec son brouillon : retour à la liste.
  if (r.ok && lire(f, "jamaisPublie") === "1") redirect("/gabarits/gerer");
  return r;
}

export async function modifierFiche(_e: EtatGabarit, f: FormData): Promise<EtatGabarit> {
  const id = lire(f, "gabaritId");
  if (lire(f, "reserve") === "1" && !f.getAll("delegations").length) return { erreur: "Coche au moins une délégation, ou choisis « Toute la section »." };
  return executer(id, (u) =>
    atelier.modifierFiche(u, id, {
      nom: lire(f, "nom"),
      description: lire(f, "description"),
      delegations: lire(f, "reserve") === "1" ? f.getAll("delegations").map(String) : [],
      actif: lire(f, "actif") === "1",
    }),
  );
}

export async function retablirRevision(_e: EtatGabarit, f: FormData): Promise<EtatGabarit> {
  const id = lire(f, "gabaritId");
  return executer(id, async (u) => ({ numero: await atelier.retablirRevision(u, id, lire(f, "revisionId")) }));
}
