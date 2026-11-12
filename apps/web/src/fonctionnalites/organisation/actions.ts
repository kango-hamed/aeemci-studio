"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import * as gestion from "./gestion";
import { ErreurImport, lireImport } from "./import-membres";
import { ROLES } from "./roles";
import { numeroPropre } from "./telephone";

/** Résultat renvoyé aux formulaires : un message d'erreur, ou le lien à transmettre au membre. */
export interface EtatAction {
  erreur?: string;
  ok?: boolean;
  /** Jeton du lien d'activation ; l'écran compose l'adresse complète avec son origine. */
  jeton?: string;
  /** Nom du membre concerné par le lien. */
  pour?: string;
  /** Son numéro : le bouton WhatsApp ouvre alors sa discussion. */
  telephone?: string | null;
}

const Poste = z.object({
  role: z.enum(ROLES as [string, ...string[]], "Choisis un rôle."),
  delegationId: z.uuid().nullable(),
});

const NouveauMembre = Poste.extend({
  nom: z.string().trim().min(2, "Saisis le nom du membre.").max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email("Saisis une adresse e-mail valide."))]),
  telephone: z.string().trim().max(40),
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
    const n = NouveauMembre.parse({
      nom: texte(f, "nom"),
      email: texte(f, "email").trim(),
      telephone: texte(f, "telephone"),
      role: texte(f, "role"),
      delegationId: delegationSaisie(f),
    });
    const telephone = n.telephone ? numeroPropre(n.telephone) : null;
    if (n.telephone && !telephone) return { erreur: "Numéro invalide : dix chiffres, ou l'indicatif précédé de + (+225 07 00 00 00 00)." };
    const r = await gestion.ajouterMembre(acteur, { ...(n as gestion.NouveauMembre), telephone });
    return { jeton: r.jeton ?? undefined, pour: n.nom, telephone };
  });
}

export async function modifierPoste(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer(async (acteur) => {
    const p = Poste.parse({ role: texte(f, "role"), delegationId: delegationSaisie(f) });
    await gestion.modifierPoste(acteur, Id.parse(texte(f, "affectationId")), p as gestion.Poste);
  });
}

export async function changerDesigner(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer((acteur) => gestion.changerDesigner(acteur, Id.parse(texte(f, "affectationId")), texte(f, "designer") === "1"));
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

export async function modifierIdentite(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer((acteur) =>
    gestion.modifierIdentite(acteur, { entete: texte(f, "entete"), rattachement: texte(f, "rattachement"), email: texte(f, "email"), telephones: texte(f, "telephones") }),
  );
}

export async function archiverDelegation(_e: EtatAction, f: FormData): Promise<EtatAction> {
  return executer((acteur) => gestion.archiverDelegation(acteur, Id.parse(texte(f, "id")), texte(f, "archivee") === "1"));
}

/** Import du bureau depuis un fichier : contrôle (rien n'est enregistré), puis import si tout est correct. */
export interface EtatImport {
  erreur?: string;
  analyse?: gestion.AnalyseImport;
  importes?: gestion.MembreImporte[];
}

export async function importerMembres(_e: EtatImport, f: FormData): Promise<EtatImport> {
  const acteur = await exigerUtilisateur();
  const fichier = f.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { erreur: "Choisis le fichier CSV des membres." };
  try {
    const lignes = lireImport(new Uint8Array(await fichier.arrayBuffer()));
    if (texte(f, "intention") !== "importer") return { analyse: await gestion.analyserImport(acteur, lignes) };
    const importes = await gestion.importerMembres(acteur, lignes);
    revalidatePath("/organisation");
    return { importes };
  } catch (e) {
    if (e instanceof ErreurImport || e instanceof gestion.ErreurOrganisation) return { erreur: e.message };
    throw e;
  }
}
