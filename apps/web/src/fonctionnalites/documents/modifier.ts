import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/serveur/db";
import { peutModifierDocument, type Acteur, type StatutDocument, type Visibilite } from "@/fonctionnalites/organisation/droits";
import { ErreurSaisie, visibiliteEffective } from "./creer";
import { notifierPublication } from "@/fonctionnalites/notifications/evenements";
import { documentLisible } from "./requetes";

export interface Modification {
  titre?: string;
  statut?: StatutDocument;
  visibilite?: Visibilite;
}

/** Titre, statut (brouillon ou publié) et visibilité d'un document : par son auteur ou le bureau. */
export async function modifierDocument(u: Acteur, id: string, m: Modification): Promise<void> {
  const l = await documentLisible(id, u);
  if (!l || !peutModifierDocument(u, l.d)) throw new ErreurSaisie("Document introuvable.");
  const titre = m.titre?.trim();
  if (m.titre !== undefined && !titre) throw new ErreurSaisie("Donne un titre au document.");
  if (m.statut && l.d.origine === "redige") throw new ErreurSaisie("Un document officiel est publié par sa validation.");
  await db
    .update(schema.document)
    .set({
      ...(titre ? { titre: titre.slice(0, 200) } : {}),
      ...(m.statut ? { statut: m.statut } : {}),
      ...(m.visibilite ? { visibilite: visibiliteEffective(m.visibilite, l.d.delegationId) } : {}),
    })
    .where(eq(schema.document.id, l.d.id));
  if (m.statut === "publie" && l.d.statut === "brouillon") await notifierPublication(l.d.id);
}
