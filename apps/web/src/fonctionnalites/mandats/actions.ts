"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import { creerMandatPasse as creerMandat } from "./archives";
import { cloreMandat as clore } from "./cloture";
import { ecrireNote } from "./passation";

export interface EtatMandat {
  erreur?: string;
  ok?: boolean;
  /** Clôture : lien d'activation du nouveau président, et son nom. */
  jeton?: string | null;
  pour?: string;
  clos?: string;
  /** Mandat passé créé pour l'import. */
  mandatId?: string;
}

const lire = (f: FormData, nom: string) => (typeof f.get(nom) === "string" ? String(f.get(nom)) : "");

async function executer(op: () => Promise<EtatMandat | void>): Promise<EtatMandat> {
  try {
    return { ok: true, ...((await op()) ?? {}) };
  } catch (e) {
    if (e instanceof ErreurSaisie) return { erreur: e.message };
    throw e;
  }
}

export async function enregistrerNote(_e: EtatMandat, f: FormData): Promise<EtatMandat> {
  const u = await exigerUtilisateur();
  const r = await executer(() => ecrireNote(u, lire(f, "cle"), lire(f, "texte")));
  revalidatePath("/passation");
  return r;
}

export async function cloreMandat(_e: EtatMandat, f: FormData): Promise<EtatMandat> {
  const u = await exigerUtilisateur();
  if (lire(f, "confirmation") !== "1") return { erreur: "Coche la case de confirmation : la clôture ne se défait pas." };
  const r = await executer(async () => {
    const c = await clore(u, { libelle: lire(f, "libelle"), nom: lire(f, "nom"), email: lire(f, "email") });
    return { jeton: c.jeton, pour: c.nom, clos: c.clos };
  });
  // Pas de revalidation ici : la page rendue à nouveau n'afficherait plus la clôture (l'ancien président perd son rôle)
  // et le lien d'activation, montré une seule fois, disparaîtrait. C'est « Continuer » qui rafraîchit l'espace.
  return r;
}

/** Après la clôture, une fois le lien d'activation transmis : menu, droits et mandat courant à jour. */
export async function continuerApresCloture(): Promise<void> {
  revalidatePath("/", "layout");
  redirect("/");
}

export async function creerMandatPasse(_e: EtatMandat, f: FormData): Promise<EtatMandat> {
  const u = await exigerUtilisateur();
  const r = await executer(async () => ({ mandatId: await creerMandat(u, lire(f, "libelle")) }));
  if (r.ok) revalidatePath("/archives");
  return r;
}
