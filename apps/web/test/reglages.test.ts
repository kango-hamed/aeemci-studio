import { describe, expect, it } from "vitest";
import type { Gabarit } from "@aeemci-studio/moteur";
import { appliquerReglages, fusionnerReglages, ReglagesInvalides } from "@/fonctionnalites/gabarits/reglages";
import { peutGererGabarits, peutUtiliserGabarit, type Acteur } from "@/fonctionnalites/organisation/droits";

function gabarit(): Gabarit {
  return {
    version: "1.0",
    champs: [
      { nom: "nom", type: "texte", libelle: "KATIMOU HALIDOU" },
      { nom: "date", type: "date" },
      { nom: "photo", type: "image" },
    ],
    plans: [
      {
        plan: "post",
        largeur_px: 1080,
        hauteur_px: 1350,
        fond: "gabarit/fond.png",
        zones: [
          { champ: "photo", forme: "box", cadre: { x: 0, y: 0, largeur: 400, hauteur: 400 } },
          { champ: "nom", forme: "point", ancre: { x: 10, ligne_de_base: 900 }, largeur_max: 800, texte: { taille_px: 60 } },
          { champ: "date", forme: "point", ancre: { x: 10, ligne_de_base: 1000 }, texte: { taille_px: 30 } },
        ],
      },
    ],
  } as Gabarit;
}

describe("réglages d'un gabarit", () => {
  it("n'applique que les réglages éditoriaux, jamais la géométrie ni les fichiers", () => {
    const recu = gabarit();
    recu.champs.reverse();
    recu.champs.find((c) => c.nom === "nom")!.libelle = "  Nom du panéliste ";
    recu.champs.find((c) => c.nom === "nom")!.max_caracteres = 40;
    recu.plans[0]!.fond = "../../secret.png";
    recu.plans[0]!.largeur_px = 1;
    const z = recu.plans[0]!.zones[1]!;
    z.debordement = { mode: "couper", taille_min_px: 30 };
    z.largeur_max = 700;
    z.ancre = { x: 999, ligne_de_base: 1 };
    (z as { modele?: string }).modele = "sans valeur";

    const r = appliquerReglages(gabarit(), recu);
    expect(r.champs.map((c) => c.nom)).toEqual(["photo", "date", "nom"]);
    expect(r.champs[2]).toEqual({ nom: "nom", type: "texte", libelle: "Nom du panéliste", max_caracteres: 40 });
    expect(r.plans[0]).toMatchObject({ fond: "gabarit/fond.png", largeur_px: 1080 });
    expect(r.plans[0]!.zones[1]).toMatchObject({ debordement: { mode: "couper", taille_min_px: 30 }, largeur_max: 700, ancre: { x: 10, ligne_de_base: 900 } });
    expect(r.plans[0]!.zones[1]).not.toHaveProperty("modele");
  });

  it("refuse des champs qui ne correspondent plus au gabarit", () => {
    const recu = gabarit();
    recu.champs.pop();
    expect(() => appliquerReglages(gabarit(), recu)).toThrow(ReglagesInvalides);
    const double = gabarit();
    double.champs[2] = { ...double.champs[0]! };
    expect(() => appliquerReglages(gabarit(), double)).toThrow(ReglagesInvalides);
  });

  it("un nouveau dossier du plugin reprend les réglages des champs et zones qui existent encore", () => {
    const ancien = gabarit();
    ancien.champs = [ancien.champs[2]!, { ...ancien.champs[0]!, libelle: "Nom du panéliste", aide: "Tel qu'il doit apparaître" }, ancien.champs[1]!];
    ancien.plans[0]!.zones[1]!.debordement = { mode: "refuser" };

    const nouveau = gabarit();
    nouveau.champs.push({ nom: "theme", type: "texte", libelle: "Thème" });
    nouveau.plans[0]!.zones[1]!.ancre = { x: 50, ligne_de_base: 950 };
    // Le champ « date » change de type dans Photoshop : ses anciens réglages ne s'appliquent plus.
    nouveau.champs[1] = { nom: "date", type: "texte", libelle: "Date (texte libre)" };
    ancien.champs[2]!.libelle = "Date de l'activité";

    const r = fusionnerReglages(nouveau, ancien);
    expect(r.champs.map((c) => c.nom)).toEqual(["photo", "nom", "date", "theme"]);
    expect(r.champs[1]).toMatchObject({ libelle: "Nom du panéliste", aide: "Tel qu'il doit apparaître" });
    expect(r.champs[2]!.libelle).toBe("Date (texte libre)");
    expect(r.plans[0]!.zones[1]).toMatchObject({ debordement: { mode: "refuser" }, ancre: { x: 50, ligne_de_base: 950 } });
  });
});

describe("droits sur les gabarits", () => {
  const membre = (delegationId: string | null, designer = false): Acteur => ({ id: "u", estAdministrateur: false, affectation: { role: "membre", delegationId, designer } });

  it("administrateurs et designers gèrent les gabarits", () => {
    expect(peutGererGabarits({ id: "a", estAdministrateur: true, affectation: null })).toBe(true);
    expect(peutGererGabarits(membre("com", true))).toBe(true);
    expect(peutGererGabarits(membre("com"))).toBe(false);
    expect(peutGererGabarits({ id: "p", estAdministrateur: false, affectation: { role: "president", delegationId: null } })).toBe(false);
  });

  it("un gabarit réservé ne sert qu'à ses délégations, au bureau et aux designers", () => {
    expect(peutUtiliserGabarit(membre("culture"), [])).toBe(true);
    expect(peutUtiliserGabarit(membre("culture"), ["com"])).toBe(false);
    expect(peutUtiliserGabarit(membre("com"), ["com", "sport"])).toBe(true);
    expect(peutUtiliserGabarit(membre("culture", true), ["com"])).toBe(true);
    expect(peutUtiliserGabarit({ id: "s", estAdministrateur: false, affectation: { role: "secretaire_general", delegationId: null } }, ["com"])).toBe(true);
  });
});
