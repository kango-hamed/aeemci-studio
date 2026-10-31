"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { ErreurSaisie } from "./creer";
import { modifierDocument } from "./modifier";

export interface EtatModification {
  erreur?: string;
  ok?: boolean;
}

const Modification = z.object({
  id: z.uuid(),
  titre: z.string().max(200).optional(),
  statut: z.enum(["brouillon", "publie"]).optional(),
  visibilite: z.enum(["bureau", "delegation", "section"]).optional(),
});

const lire = (f: FormData, nom: string) => (typeof f.get(nom) === "string" ? String(f.get(nom)) : undefined);

export async function enregistrerDocument(_e: EtatModification, f: FormData): Promise<EtatModification> {
  const u = await exigerUtilisateur();
  const m = Modification.safeParse({ id: lire(f, "id"), titre: lire(f, "titre"), statut: lire(f, "statut"), visibilite: lire(f, "visibilite") });
  if (!m.success) return { erreur: "Saisie invalide." };
  try {
    await modifierDocument(u, m.data.id, m.data);
  } catch (e) {
    if (e instanceof ErreurSaisie) return { erreur: e.message };
    throw e;
  }
  revalidatePath(`/documents/${m.data.id}`);
  return { ok: true };
}
