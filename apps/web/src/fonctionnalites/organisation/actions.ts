"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import * as gestion from "./gestion";
import { ROLES } from "./roles";

/** Résultat renvoyé aux formulaires : un message d'erreur, ou le lien à transmettre au membre. */
export interface EtatAction {
  erreur?: string;
  ok?: boolean;
  /** Jeton du lien d'activation ; l'écran compose l'adresse complète avec son origine. */
  jeton?: string;
  /** Nom du membre concerné par le lien. */
  pour?: string;
}

const Poste = z.object({
  role: z.enum(ROLES as [string, ...string[]], "Choisis un rôle."),
  delegationId: z.uuid().nullable(),
});

const NouveauMembre = Poste.extend({
  nom: z.string().trim().min(2, "Saisis le nom du membre.").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Saisis une adresse e-mail valide.")),
});

const Id = z.string().min(1).max(64);

function texte(f: FormData, nom: string): string {
  const v = f.get(nom);
  return typeof v === "string" ? v : "";
}

const delegationSaisie = (f: FormData) => texte(f, "delegationId") || null;

/** Exécute une opération de gestion, traduit ses refus en message et rafraîchit l'écran. */
async function executer(op: (acteur: Awaited<ReturnType<typeof exigerUtilisateur>>) => Promise<EtatAction | void>): Promise<EtatAction> {
  const acteur = await exigerUtilisateur();
  try {
    const r = (await op(acteur)) ?? {};
    revalidatePath("/organisation");
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof gestion.ErreurOrganisation) return { erreur: e.message };
    if (e instanceof z.ZodError) return { erreur: e.issues[0]?.message ?? "Saisie invalide." };
    throw e;
  }
}

export async function ajouterMembre(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer(async (acteur) => {
    const n = NouveauMembre.parse({ nom: texte(f, "nom"), email: texte(f, "email"), role: texte(f, "role"), delegationId: delegationSaisie(f) });
    const r = await gestion.ajouterMembre(acteur, n as gestion.NouveauMembre);
    return { jeton: r.jeton ?? undefined, pour: n.nom };
  });
}

export async function modifierPoste(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer(async (acteur) => {
    const p = Poste.parse({ role: texte(f, "role"), delegationId: delegationSaisie(f) });
    await gestion.modifierPoste(acteur, Id.parse(texte(f, "affectationId")), p as gestion.Poste);
  });
}

export async function retirerDuMandat(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer((acteur) => gestion.retirerDuMandat(acteur, Id.parse(texte(f, "affectationId"))));
}

export async function lienPourMembre(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer(async (acteur) => ({ jeton: await gestion.lienPourMembre(acteur, Id.parse(texte(f, "userId"))), pour: texte(f, "nom") }));
}

export async function creerDelegation(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer(async (acteur) => {
    await gestion.creerDelegation(acteur, texte(f, "nom"), texte(f, "code"));
  });
}

export async function renommerDelegation(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer((acteur) => gestion.renommerDelegation(acteur, Id.parse(texte(f, "id")), texte(f, "nom"), f.has("code") ? texte(f, "code") : undefined));
}

export async function archiverDelegation(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer((acteur) => gestion.archiverDelegation(acteur, Id.parse(texte(f, "id")), texte(f, "archivee") === "1"));
}
