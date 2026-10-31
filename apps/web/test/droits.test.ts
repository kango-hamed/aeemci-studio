import { describe, expect, it } from "vitest";
import {
  peutCreerDocuments,
  peutGererOrganisation,
  peutLireDocument,
  peutModifierDocument,
  peutToucherAuPresident,
  type Acteur,
  type StatutDocument,
  type Visibilite,
} from "@/fonctionnalites/organisation/droits";
import type { Role } from "@/fonctionnalites/organisation/roles";

const membre = (role: Role | null, delegationId: string | null = null, estAdministrateur = false): Acteur => ({
  id: "moi",
  estAdministrateur,
  affectation: role ? { role, delegationId } : null,
});

describe("droits", () => {
  it("seuls le bureau exécutif et les administrateurs gèrent l'organisation", () => {
    expect(peutGererOrganisation(membre("president"))).toBe(true);
    expect(peutGererOrganisation(membre("vice_president"))).toBe(true);
    expect(peutGererOrganisation(membre("secretaire_general"))).toBe(true);
    expect(peutGererOrganisation(membre("responsable_delegation", "culture"))).toBe(false);
    expect(peutGererOrganisation(membre("membre", "culture"))).toBe(false);
    expect(peutGererOrganisation(membre(null, null, true))).toBe(true);
    expect(peutGererOrganisation(membre(null))).toBe(false);
  });

  it("le rôle de président ne se touche que par le président ou un administrateur", () => {
    expect(peutToucherAuPresident(membre("president"))).toBe(true);
    expect(peutToucherAuPresident(membre("secretaire_general"))).toBe(false);
    expect(peutToucherAuPresident(membre(null, null, true))).toBe(true);
  });

  it("sans rôle dans le mandat en cours, on ne crée plus rien", () => {
    expect(peutCreerDocuments(membre("membre", "culture"))).toBe(true);
    expect(peutCreerDocuments(membre(null))).toBe(false);
    expect(peutCreerDocuments(membre(null, null, true))).toBe(true);
  });

  it("un membre lit les documents de sa délégation, pas ceux des autres ; le bureau lit tout", () => {
    const deLaCom = { auteurId: "autre", delegationId: "communication", statut: "publie", visibilite: "delegation" } as const;
    const duBureau = { auteurId: "autre", delegationId: null, statut: "publie", visibilite: "bureau" } as const;
    expect(peutLireDocument(membre("membre", "communication"), deLaCom)).toBe(true);
    expect(peutLireDocument(membre("responsable_delegation", "culture"), deLaCom)).toBe(false);
    expect(peutLireDocument(membre("membre", "culture"), duBureau)).toBe(false);
    expect(peutLireDocument(membre("president"), deLaCom)).toBe(true);
    expect(peutLireDocument(membre("president"), duBureau)).toBe(true);
    expect(peutLireDocument(membre(null), { ...deLaCom, auteurId: "moi" })).toBe(true);
    expect(peutLireDocument(membre(null), deLaCom)).toBe(false);
  });

  it("visibilité : « section » pour tous, « bureau » pour personne de plus ; un brouillon reste à l'auteur et au bureau", () => {
    const doc = (visibilite: Visibilite, statut: StatutDocument = "publie") => ({ auteurId: "autre", delegationId: "communication", statut, visibilite });
    expect(peutLireDocument(membre("membre", "culture"), doc("section"))).toBe(true);
    expect(peutLireDocument(membre(null), doc("section"))).toBe(true);
    expect(peutLireDocument(membre("membre", "communication"), doc("bureau"))).toBe(false);
    expect(peutLireDocument(membre("secretaire_general"), doc("bureau"))).toBe(true);
    expect(peutLireDocument(membre("membre", "communication"), doc("delegation", "brouillon"))).toBe(false);
    expect(peutLireDocument(membre("membre", "culture"), doc("section", "brouillon"))).toBe(false);
    expect(peutLireDocument(membre("president"), doc("delegation", "brouillon"))).toBe(true);
    expect(peutLireDocument(membre(null), { ...doc("bureau", "brouillon"), auteurId: "moi" })).toBe(true);
  });

  it("seuls l'auteur, le bureau et les administrateurs modifient un document", () => {
    expect(peutModifierDocument(membre("membre", "communication"), { auteurId: "moi" })).toBe(true);
    expect(peutModifierDocument(membre("responsable_delegation", "communication"), { auteurId: "autre" })).toBe(false);
    expect(peutModifierDocument(membre("vice_president"), { auteurId: "autre" })).toBe(true);
    expect(peutModifierDocument(membre(null, null, true), { auteurId: "autre" })).toBe(true);
  });
});
