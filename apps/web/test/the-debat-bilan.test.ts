/** Bilan de la plateforme Thé Débat : forme attendue et texte reporté dans le bilan de l'activité. */
import { describe, expect, it } from "vitest";
import { SchemaResultats, texteBilan, themesDebattus, type ResultatsTheDebat } from "@/fonctionnalites/activites/the-debat-bilan";

const RESULTATS: ResultatsTheDebat = {
  edition: { id: "8d3c2f1e-0000-4000-8000-000000000001", titre: "Thé Débat 2026", date: "2026-12-07T15:00:00.000Z", lieu: "Amphi A", statut: "terminee" },
  vote: {
    votants: 87,
    themes: [
      { titre: "Réseaux sociaux et foi", voix: 52, retenu: true },
      { titre: "Mariage pendant les études", voix: 41, retenu: true },
      { titre: "Travail et études", voix: 0, retenu: false },
    ],
  },
  debatteurs: [
    { theme: "Réseaux sociaux et foi", camp: "pour", nom: "Awa Koné", filiere: "TELECOM" },
    { theme: "Réseaux sociaux et foi", camp: "contre", nom: "Ali Traoré", filiere: null },
    { theme: "Mariage pendant les études", camp: "pour", nom: "Fatou Bamba", filiere: null },
  ],
  inscriptions: { validees: 3, listeAttente: 2 },
  presence: { presents: 142, parQr: 120, parRecherche: 15, ajoutesSurPlace: 7, debatteursPresents: 3 },
  genereLe: "2026-12-07T20:00:00.000Z",
};

describe("Thé Débat : bilan", () => {
  it("la réponse de l'API est validée ; une réponse inattendue est refusée", () => {
    expect(SchemaResultats.safeParse(RESULTATS).success).toBe(true);
    expect(SchemaResultats.safeParse({ ...RESULTATS, presence: { presents: -1 } }).success).toBe(false);
  });

  it("thèmes retenus avec leurs débatteurs par camp", () => {
    expect(themesDebattus(RESULTATS).map((t) => [t.titre, t.pour, t.contre])).toEqual([
      ["Réseaux sociaux et foi", ["Awa Koné"], ["Ali Traoré"]],
      ["Mariage pendant les études", ["Fatou Bamba"], []],
    ]);
  });

  it("texte du bilan : participation, vote, thèmes débattus, débatteurs", () => {
    const t = texteBilan(RESULTATS);
    expect(t).toContain("Participation : 142 présents (120 par QR code, 15 retrouvés à l'accueil, 7 inscrits sur place).");
    expect(t).toContain("Vote des thèmes : 87 votants. Classement : « Réseaux sociaux et foi » (52 voix), « Mariage pendant les études » (41 voix).");
    expect(t).toContain("- « Mariage pendant les études » : pour, Fatou Bamba ; contre, personne.");
    expect(t).toContain("Débatteurs : 3 inscriptions validées, 2 sur liste d'attente ; 3 présents le jour J.");
    expect(t).not.toContain("Travail et études");
  });

  it("une édition sans activité encore ne produit aucun texte", () => {
    const vide = { ...RESULTATS, vote: { votants: 0, themes: [] }, debatteurs: [], inscriptions: { validees: 0, listeAttente: 0 }, presence: { presents: 0, parQr: 0, parRecherche: 0, ajoutesSurPlace: 0, debatteursPresents: 0 } };
    expect(texteBilan(vide)).toBe("");
  });
});
