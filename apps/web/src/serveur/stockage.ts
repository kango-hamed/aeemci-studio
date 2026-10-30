import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Stockage des fichiers (fonds et couches des gabarits, photos importées, documents générés).
 *
 * - `STOCKAGE=r2` (production) : Cloudflare R2, par son API compatible S3. Variables `R2_COMPTE`
 *   (identifiant du compte Cloudflare), `R2_CLE`, `R2_SECRET`, `R2_SEAU`.
 * - sinon : un dossier local (`STOCKAGE_DOSSIER`, défaut `.stockage`). Pour le développement et
 *   les tests seulement : le disque d'un conteneur Cloud Run est effacé à chaque redémarrage.
 *
 * Les fichiers ne sont jamais servis directement : l'application les lit après avoir vérifié les droits.
 * Clés : `gabarits/<gabarit>/<revision>/…`, `televersements/<membre>/<id>`, `documents/<id>/…`.
 */
export interface Stockage {
  readonly genre: "local" | "r2";
  ecrire(cle: string, contenu: Buffer, type: string): Promise<void>;
  /** `null` si la clé n'existe pas. */
  lire(cle: string): Promise<Buffer | null>;
  supprimer(cle: string): Promise<void>;
}

function verifierCle(cle: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(cle) || cle.includes("..") || cle.includes("//")) throw new Error(`Clé de stockage invalide : ${cle}`);
  return cle;
}

export class StockageLocal implements Stockage {
  readonly genre = "local" as const;
  constructor(private readonly racine: string) {}
  private chemin(cle: string) {
    return path.join(this.racine, verifierCle(cle));
  }
  async ecrire(cle: string, contenu: Buffer): Promise<void> {
    const c = this.chemin(cle);
    await fs.mkdir(path.dirname(c), { recursive: true });
    await fs.writeFile(c, contenu);
  }
  async lire(cle: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.chemin(cle));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }
  async supprimer(cle: string): Promise<void> {
    await fs.rm(this.chemin(cle), { force: true });
  }
}

export class StockageR2 implements Stockage {
  readonly genre = "r2" as const;
  private readonly client: S3Client;
  constructor(
    compte: string,
    cle: string,
    secret: string,
    private readonly seau: string,
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${compte}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cle, secretAccessKey: secret },
    });
  }
  async ecrire(cle: string, contenu: Buffer, type: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.seau, Key: verifierCle(cle), Body: contenu, ContentType: type }));
  }
  async lire(cle: string): Promise<Buffer | null> {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.seau, Key: verifierCle(cle) }));
      return r.Body ? Buffer.from(await r.Body.transformToByteArray()) : null;
    } catch (e) {
      if (e instanceof NoSuchKey || (e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }
  async supprimer(cle: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.seau, Key: verifierCle(cle) }));
  }
}

let instance: Stockage | null = null;

export function stockage(): Stockage {
  if (instance) return instance;
  if (process.env.STOCKAGE === "r2") {
    const manquantes = ["R2_COMPTE", "R2_CLE", "R2_SECRET", "R2_SEAU"].filter((v) => !process.env[v]);
    if (manquantes.length) throw new Error(`Stockage R2 : variables manquantes (${manquantes.join(", ")}).`);
    instance = new StockageR2(process.env.R2_COMPTE!, process.env.R2_CLE!, process.env.R2_SECRET!, process.env.R2_SEAU!);
  } else {
    instance = new StockageLocal(path.resolve(/*turbopackIgnore: true*/ process.env.STOCKAGE_DOSSIER ?? ".stockage"));
  }
  return instance;
}
