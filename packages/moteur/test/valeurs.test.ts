import { describe, expect, it } from "vitest";
import { calquerCasse, etatJauge, formaterNombre, lireNombre, texteDeZone, validerValeurs } from "../src/valeurs.ts";
import type { Gabarit } from "../src/types.ts";

const NBSP = " ";

describe("formats français", () => {
  it("lit et formate les nombres", () => {
    expect(lireNombre("166 000")).toBe(166000);
    expect(lireNombre("5,45")).toBe(5.45);
    expect(lireNombre("12 abc")).toBeNull();
    expect(formaterNombre(3047900)).toBe(`3${NBSP}047${NBSP}900`);
    expect(formaterNombre(5.45)).toBe("5,45");
    expect(formaterNombre(5.5)).toBe("5,5");
  });

  it("formate une date éclatée en zones, avec la casse du designer", () => {
    const champ = { nom: "date", type: "date" as const };
    const v = "2026-11-15";
    expect(texteDeZone({ champ: "date", format: "EEE", exemple: "Sam" }, champ, v)).toBe("Dim");
    expect(texteDeZone({ champ: "date", format: "d", exemple: "15" }, champ, v)).toBe("15");
    expect(texteDeZone({ champ: "date", format: "MMMM", exemple: "Novembre" }, champ, v)).toBe("Novembre");
    expect(texteDeZone({ champ: "date", format: "MMMM", exemple: "NOVEMBRE" }, champ, v)).toBe("NOVEMBRE");
    expect(texteDeZone({ champ: "date" }, champ, v)).toBe("dimanche 15 novembre 2026");
    expect(calquerCasse("sam.", "sam")).toBe("sam.");
  });

  it("applique le modèle autour de la valeur", () => {
    expect(texteDeZone({ champ: "c", modele: "Collecté : {valeur} f CFA" }, { nom: "c", type: "nombre" }, "166000")).toBe(`Collecté : 166${NBSP}000 f CFA`);
    expect(texteDeZone({ champ: "c", modele: "Collecté : {valeur} f CFA" }, { nom: "c", type: "nombre" }, "")).toBe("");
  });
});

describe("jauge de collecte", () => {
  const collecte: Gabarit = {
    version: "1.0",
    champs: [
      { nom: "montant", type: "nombre", libelle: "Montant collecté" },
      { nom: "objectif", type: "nombre", libelle: "Objectif", obligatoire: false },
      { nom: "barre", type: "jauge", libelle: "Jauge", min: 0, max: 3000000, valeur_de: "montant", objectif_de: "objectif" },
    ],
    plans: [
      {
        plan: "p",
        largeur_px: 10,
        hauteur_px: 10,
        zones: [
          { champ: "montant", modele: "Collecté : {valeur} sur {objectif} f CFA" },
          { champ: "montant", modele: "{pourcentage} de l'objectif" },
          { champ: "barre", cadre: { x: 0, y: 0, largeur: 10, hauteur: 2 }, jauge: { min: 0, max: 3000000 } },
        ],
      },
    ],
  };
  const montant = collecte.champs[0]!;
  const barre = collecte.champs[2]!;
  const zones = collecte.plans[0]!.zones;

  it("prend la valeur dans le montant et l'objectif dans son champ, sinon le maximum du gabarit", () => {
    expect(etatJauge(barre, { montant: "1 500 000" })).toMatchObject({ valeur: 1500000, objectif: 3000000, ratio: 0.5 });
    expect(etatJauge(barre, { montant: "1 500 000", objectif: "2 000 000" })).toMatchObject({ objectif: 2000000, ratio: 0.75 });
    expect(etatJauge(barre, { montant: "2 400 000", objectif: "2 000 000" })).toMatchObject({ ratio: 1, part: 1.2 });
  });

  it("écrit le montant, l'objectif et le pourcentage atteint", () => {
    const valeurs = { montant: "2 400 000", objectif: "2 000 000" };
    expect(texteDeZone(zones[0]!, montant, valeurs.montant, { gabarit: collecte, valeurs })).toBe(`Collecté : 2${NBSP}400${NBSP}000 sur 2${NBSP}000${NBSP}000 f CFA`);
    expect(texteDeZone(zones[1]!, montant, valeurs.montant, { gabarit: collecte, valeurs })).toBe(`120${NBSP}% de l'objectif`);
    expect(texteDeZone(zones[1]!, montant, "", { gabarit: collecte, valeurs: {} })).toBe("");
  });

  it("ne demande pas la jauge reliée : le montant est contrôlé pour elle", () => {
    expect(validerValeurs(collecte, { montant: "1 500 000" })).toEqual([]);
    expect(validerValeurs(collecte, { montant: "beaucoup" })).toEqual([{ champ: "montant", message: "« Montant collecté » doit être un nombre." }]);
  });
});

describe("validation", () => {
  const gabarit: Gabarit = {
    version: "1.0",
    champs: [
      { nom: "nom", type: "texte", libelle: "Nom", obligatoire: true, max_caracteres: 10 },
      { nom: "date", type: "date", libelle: "Date" },
      { nom: "collecte", type: "jauge", libelle: "Collecté", min: 0, max: 1000 },
      { nom: "note", type: "texte", obligatoire: false },
    ],
    plans: [{ plan: "p", largeur_px: 10, hauteur_px: 10, zones: [{ champ: "nom", debordement: { mode: "refuser" } }] }],
  };

  it("signale les champs manquants, mal formés ou trop longs", () => {
    expect(validerValeurs(gabarit, { nom: "Rakistaba Adama", date: "15/11/2026", collecte: "beaucoup" })).toEqual([
      { champ: "nom", message: "« Nom » : 10 caractères au plus (15 saisis)." },
      { champ: "date", message: "« Date » : date attendue au format AAAA-MM-JJ." },
      { champ: "collecte", message: "« Collecté » doit être un nombre." },
    ]);
    // Une collecte peut dépasser son objectif : la jauge est alors pleine.
    expect(validerValeurs(gabarit, { nom: "Awa", date: "2026-11-15", collecte: "2000" })).toEqual([]);
    expect(validerValeurs(gabarit, {})).toHaveLength(3);
    expect(validerValeurs(gabarit, { nom: "Awa", date: "2026-11-15", collecte: 500 })).toEqual([]);
  });
});

import fs from "node:fs";
import path from "node:path";
import { CataloguePolices } from "../src/polices.ts";

describe("polices installées avec le moteur", () => {
  it("chaque entrée du catalogue a son fichier, dont les polices des gabarits de la section", () => {
    const chemin = path.join(import.meta.dirname, "../polices/polices.json");
    const liste = JSON.parse(fs.readFileSync(chemin, "utf8")) as { fichier: string }[];
    for (const p of liste) expect(fs.existsSync(path.join(path.dirname(chemin), p.fichier)), p.fichier).toBe(true);
    const cat = CataloguePolices.depuisFichier(chemin);
    expect(cat.manquantes(["Montserrat-Bold", "Montserrat-Medium", "Outfit-Regular", "Outfit-Black"])).toEqual([]);
  });
});
