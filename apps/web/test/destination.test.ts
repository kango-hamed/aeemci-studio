import { describe, expect, it } from "vitest";
import { destinationSure } from "@/fonctionnalites/authentification/destination";
import { mandatParDefaut } from "../scripts/creer-admin.ts";

describe("destination après connexion", () => {
  it("garde une page de l'application", () => {
    expect(destinationSure("/documents?x=1")).toBe("/documents?x=1");
  });
  it("refuse tout autre site", () => {
    for (const v of ["https://exemple.com", "//exemple.com", "/\\exemple.com", "", null, 42]) expect(destinationSure(v)).toBe("/");
  });
});

describe("mandat par défaut", () => {
  it("suit l'année universitaire, qui commence en septembre", () => {
    expect(mandatParDefaut(new Date(2026, 9, 30))).toBe("2026-2027");
    expect(mandatParDefaut(new Date(2026, 5, 1))).toBe("2025-2026");
  });
});

import { titreParDefaut } from "@/fonctionnalites/generation/valeurs";
import type { Gabarit } from "@aeemci-studio/moteur";

describe("titre par défaut d'un document", () => {
  const g = {
    version: "1.0",
    champs: [
      { nom: "poste", type: "texte", libelle: "Poste ou fonction" },
      { nom: "nom_paneliste", type: "texte", libelle: "Nom du panéliste" },
      { nom: "photo", type: "image" },
    ],
    plans: [],
  } as unknown as Gabarit;
  it("préfère le nom de la personne au premier champ", () => {
    expect(titreParDefaut("Panel", g, { poste: "Auditrice IT", nom_paneliste: "Awa  Koné" })).toBe("Panel – Awa Koné");
  });
  it("prend le premier texte saisi sinon, ou le nom du gabarit seul", () => {
    expect(titreParDefaut("Panel", g, { poste: "Auditrice IT" })).toBe("Panel – Auditrice IT");
    expect(titreParDefaut("Panel", g, {})).toBe("Panel");
  });
});
