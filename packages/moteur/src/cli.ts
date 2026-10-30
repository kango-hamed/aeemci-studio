#!/usr/bin/env node
/**
 * aeemci-rendre --gabarit <manifest.json> --valeurs <valeurs.json> --polices <polices.json>
 *               [--sortie <dossier>] [--format png|jpeg|pdf] [--largeur <px>] [--plan <nom>]
 * Le manifest peut être un manifest DesignHub 1.1 complet ou la seule section `gabarit`.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { CataloguePolices } from "./polices.ts";
import { ErreurRendu, rendrePlan, rendreTout } from "./rendu.ts";
import type { Gabarit } from "./types.ts";

const { values: a } = parseArgs({
  options: {
    gabarit: { type: "string" },
    valeurs: { type: "string" },
    polices: { type: "string" },
    sortie: { type: "string", default: "." },
    format: { type: "string", default: "png" },
    largeur: { type: "string" },
    plan: { type: "string" },
  },
});
if (!a.gabarit || !a.valeurs || !a.polices) {
  console.error("Usage : aeemci-rendre --gabarit manifest.json --valeurs valeurs.json --polices polices.json [--sortie dossier] [--format png|jpeg|pdf] [--largeur px] [--plan nom]");
  process.exit(2);
}
const brut = JSON.parse(fs.readFileSync(a.gabarit, "utf8"));
const gabarit: Gabarit = brut.gabarit ?? brut;
const options = {
  gabarit,
  dossier: path.dirname(path.resolve(a.gabarit)),
  valeurs: JSON.parse(fs.readFileSync(a.valeurs, "utf8")),
  dossierImages: path.dirname(path.resolve(a.valeurs)),
  polices: CataloguePolices.depuisFichier(a.polices),
  format: a.format as "png" | "jpeg" | "pdf",
  ...(a.largeur ? { largeurSortie: Number(a.largeur) } : {}),
};
try {
  const resultats = a.plan ? [await rendrePlan({ ...options, plan: a.plan })] : await rendreTout(options);
  fs.mkdirSync(a.sortie!, { recursive: true });
  for (const r of resultats) {
    const nom = path.join(a.sortie!, `${r.plan.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^A-Za-z0-9-]+/g, "-").toLowerCase()}.${a.format === "jpeg" ? "jpg" : a.format}`);
    fs.writeFileSync(nom, r.fichier);
    console.log(`${nom} (${r.largeur} × ${r.hauteur})`);
    for (const z of r.rapport.filter((z) => z.reduit || z.coupe || z.depasse)) {
      console.log(`  ⚠ ${z.champ} : ${z.depasse ? "déborde encore" : z.coupe ? "texte coupé" : `réduit à ${z.taille} px`}`);
    }
  }
} catch (e) {
  if (e instanceof ErreurRendu) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
