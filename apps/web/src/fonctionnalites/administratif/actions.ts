"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ErreurSaisie } from "@/fonctionnalites/documents/creer";
import * as circuit from "./circuit";
import { changerInterim as changerInterimMandat } from "./signatures";

export interface EtatCircuit {
  erreur?: string;
  erreurs?: { champ: string; message: string }[];
  ok?: boolean;
}

const Id = z.uuid();
const lire = (f: FormData, nom: string) => (typeof f.get(nom) === "string" ? String(f.get(nom)) : "");

async function executer(op: () => Promise<void>): Promise<EtatCircuit | null> {
  try {
    await op();
    return null;
  } catch (e) {
    if (e instanceof ErreurSaisie) return { erreur: e.message, erreurs: e.erreurs };
    if (e instanceof z.ZodError) return { erreur: "Saisie invalide." };
    throw e;
  }
}

/**
 * Rédaction : enregistre (`intention=enregistrer`) ou enregistre puis soumet (`intention=soumettre`).
 * Les champs du document arrivent préfixés : `c.objet`, `c.corps`…
 */
export async function enregistrerRedaction(_e: EtatCircuit, f: FormData): Promise<EtatCircuit> {
  const u = await exigerUtilisateur();
  const contenu: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (k.startsWith("c.") && typeof v === "string") contenu[k.slice(2)] = v;
  const visibilite = z.enum(["bureau", "delegation", "section"]).optional().catch(undefined).parse(lire(f, "visibilite") || undefined);
  let id = lire(f, "id") || undefined;
  const echec = await executer(async () => {
    if (id) Id.parse(id);
    const r = await circuit.enregistrerRedaction(
      u,
      { id, type: lire(f, "type"), contenu, titre: lire(f, "titre"), visibilite },
      { mandatId: u.affectation?.mandatId ?? null, delegationId: u.affectation?.delegationId ?? null },
    );
    id = r.id;
  });
  if (echec) return echec;
  revalidatePath(`/documents/${id}`);
  if (lire(f, "intention") === "soumettre") {
    const refus = await executer(() => circuit.soumettre(u, id!));
    // Enregistré mais pas soumis (incomplet…) : on reste sur la rédaction, avec le document créé.
    if (refus) {
      const message = [refus.erreur, ...(refus.erreurs ?? []).map((x) => x.message)].join(" ");
      if (!lire(f, "id")) redirect(`/rediger/${id}?refus=${encodeURIComponent(message.slice(0, 500))}`);
      return refus;
    }
    revalidatePath("/a-valider");
    redirect(`/documents/${id}`);
  }
  if (!lire(f, "id")) redirect(`/rediger/${id}`);
  return { ok: true };
}

async function surDocument(f: FormData, op: (u: Awaited<ReturnType<typeof exigerUtilisateur>>, id: string) => Promise<void>): Promise<EtatCircuit> {
  const u = await exigerUtilisateur();
  const id = lire(f, "id");
  const echec = await executer(() => op(u, Id.parse(id)));
  if (echec) return echec;
  revalidatePath(`/documents/${id}`);
  revalidatePath("/a-valider");
  return { ok: true };
}

export async function soumettre(_e: EtatCircuit, f: FormData): Promise<EtatCircuit> {
  return surDocument(f, (u, id) => circuit.soumettre(u, id));
}

export async function demanderCorrection(_e: EtatCircuit, f: FormData): Promise<EtatCircuit> {
  return surDocument(f, (u, id) => circuit.demanderCorrection(u, id, lire(f, "commentaire")));
}

export async function valider(_e: EtatCircuit, f: FormData): Promise<EtatCircuit> {
  return surDocument(f, async (u, id) => {
    await circuit.valider(u, id);
  });
}

export async function nouvelleVersion(_e: EtatCircuit, f: FormData): Promise<EtatCircuit> {
  const u = await exigerUtilisateur();
  let nouveau = "";
  const echec = await executer(async () => {
    nouveau = (await circuit.nouvelleVersion(u, Id.parse(lire(f, "id")), { mandatId: u.affectation?.mandatId ?? null, delegationId: null })).id;
  });
  if (echec) return echec;
  redirect(`/rediger/${nouveau}`);
}

export async function changerInterim(_e: EtatCircuit, f: FormData): Promise<EtatCircuit> {
  const u = await exigerUtilisateur();
  const echec = await executer(() => changerInterimMandat(u, lire(f, "actif") === "1"));
  if (echec) return echec;
  revalidatePath("/signature");
  revalidatePath("/a-valider");
  return { ok: true };
}
