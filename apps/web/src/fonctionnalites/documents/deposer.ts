import "server-only";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/serveur/db";
import { stockage } from "@/serveur/stockage";
import type { StatutDocument, Visibilite } from "@/fonctionnalites/organisation/droits";
import { notifierPublication } from "@/fonctionnalites/notifications/evenements";
import { ErreurSaisie, visibiliteEffective, type Rattachement } from "./creer";

/** Fichiers acceptés au dépôt, reconnus par leurs premiers octets (pas par l'extension annoncée). */
const SIGNATURES: { type: string; ext: string; ok: (b: Buffer) => boolean }[] = [
  { type: "application/pdf", ext: "pdf", ok: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { type: "image/jpeg", ext: "jpg", ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/png", ext: "png", ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/webp", ext: "webp", ok: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" },
];

export const TAILLE_MAX_DEPOT = 20 * 1024 * 1024;
const TAILLE_MAX_MINIATURE = 512 * 1024;

export function reconnaitre(contenu: Buffer): { type: string; ext: string } | null {
  return SIGNATURES.find((s) => s.ok(contenu)) ?? null;
}

/** Nom de fichier sûr pour le téléchargement : sans chemin ni caractère de contrôle. */
function nomPropre(nom: string, ext: string): string {
  const base = nom.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\.[^.]*$/, "").trim().slice(0, 120);
  return `${base || "document"}.${ext}`;
}

export interface Depot {
  contenu: Buffer;
  nomFichier: string;
  titre?: string;
  /** Miniature JPEG préparée par le navigateur (images seulement). */
  miniature?: Buffer;
  /** Dimensions de l'image, mesurées par le navigateur. */
  largeur?: number;
  hauteur?: number;
  statut?: StatutDocument;
  visibilite?: Visibilite;
  /** Photo ou pièce d'une activité (droits vérifiés par l'appelant). */
  activiteId?: string;
}

/** Dépose un fichier existant (PDF, image, scan) comme document de la plateforme. */
export async function deposerDocument(d: Depot, userId: string, rattachement: Rattachement): Promise<{ id: string }> {
  if (!d.contenu.length) throw new ErreurSaisie("Le fichier est vide.");
  if (d.contenu.length > TAILLE_MAX_DEPOT) throw new ErreurSaisie("Fichier trop lourd (20 Mo au plus).");
  const genre = reconnaitre(d.contenu);
  if (!genre) throw new ErreurSaisie("Format non pris en charge : dépose un PDF ou une image (JPEG, PNG, WebP).");
  const estImage = genre.type.startsWith("image/");
  const miniature = estImage && d.miniature && d.miniature.length <= TAILLE_MAX_MINIATURE && reconnaitre(d.miniature)?.type === "image/jpeg" ? d.miniature : null;
  const dimension = (n?: number) => (estImage && Number.isInteger(n) && n! > 0 && n! <= 20000 ? n! : null);

  const id = randomUUID();
  const nomFichier = nomPropre(d.nomFichier, genre.ext);
  const cle = `documents/${id}/depot.${genre.ext}`;
  await stockage().ecrire(cle, d.contenu, genre.type);
  if (miniature) await stockage().ecrire(`documents/${id}/miniature.jpg`, miniature, "image/jpeg");
  await db.insert(schema.document).values({
    id,
    auteurId: userId,
    origine: "depose",
    titre: (d.titre?.trim() || nomFichier.replace(/\.[^.]+$/, "")).slice(0, 200),
    fichier: cle,
    type: genre.type,
    nomFichier,
    taille: d.contenu.length,
    largeur: dimension(d.largeur),
    hauteur: dimension(d.hauteur),
    miniature: miniature ? `documents/${id}/miniature.jpg` : null,
    mandatId: rattachement.mandatId,
    delegationId: rattachement.delegationId,
    statut: d.statut ?? "publie",
    visibilite: visibiliteEffective(d.visibilite, rattachement.delegationId),
    activiteId: d.activiteId ?? null,
  });
  // Les photos d'une activité arrivent par séries : on ne prévient pas pour chacune.
  if (!d.activiteId) await notifierPublication(id);
  return { id };
}
