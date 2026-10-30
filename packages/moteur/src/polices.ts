/**
 * Catalogue des polices du serveur de rendu. Les zones désignent une police par son nom
 * PostScript (relevé par le plugin) ; le catalogue dit quel fichier l'implémente.
 * Les fichiers ne viennent JAMAIS du designer (licences) : ils sont installés côté serveur.
 */
import fs from "node:fs";
import path from "node:path";
import type { Police } from "./types.ts";

export class CataloguePolices {
  private parNom = new Map<string, Police>();

  constructor(polices: Police[]) {
    for (const p of polices) this.parNom.set(p.nom_postscript, p);
  }

  /** Lit un fichier polices.json : [{ nom_postscript, famille, graisse, fichier }] ; chemins relatifs à ce fichier. */
  static depuisFichier(chemin: string): CataloguePolices {
    const dossier = path.dirname(path.resolve(chemin));
    const liste = JSON.parse(fs.readFileSync(chemin, "utf8")) as Police[];
    return new CataloguePolices(liste.map((p) => ({ ...p, fichier: path.resolve(dossier, p.fichier) })));
  }

  trouver(nomPostscript: string | undefined): Police | undefined {
    return nomPostscript ? this.parNom.get(nomPostscript) : undefined;
  }

  /** Polices nécessaires et absentes du catalogue, pour un ensemble de noms PostScript. */
  manquantes(noms: Iterable<string>): string[] {
    return [...new Set(noms)].filter((n) => !this.parNom.has(n));
  }

  /** Alias CSS unique par police : évite tout appariement approximatif de graisse par le navigateur. */
  static alias(nomPostscript: string): string {
    return `p_${nomPostscript.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  }
}
