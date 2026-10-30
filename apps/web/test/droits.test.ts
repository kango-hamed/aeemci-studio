import { describe, expect, it } from "vitest";
import { peutCreerDocuments, peutGererOrganisation, peutLireDocument, peutToucherAuPresident, type Acteur } from "@/fonctionnalites/organisation/droits";
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
    const deLaCom = { auteurId: "autre", delegationId: "communication" };
    const duBureau = { auteurId: "autre", delegationId: null };
    expect(peutLireDocument(membre("membre", "communication"), deLaCom)).toBe(true);
    expect(peutLireDocument(membre("responsable_delegation", "culture"), deLaCom)).toBe(false);
    expect(peutLireDocument(membre("membre", "culture"), duBureau)).toBe(false);
    expect(peutLireDocument(membre("president"), deLaCom)).toBe(true);
    expect(peutLireDocument(membre("president"), duBureau)).toBe(true);
    expect(peutLireDocument(membre(null), { auteurId: "moi", delegationId: "culture" })).toBe(true);
    expect(peutLireDocument(membre(null), deLaCom)).toBe(false);
  });
});
