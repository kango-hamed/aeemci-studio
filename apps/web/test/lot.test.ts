/** Création par lot : colonnes et familles, valeurs calculées écrites comme dans Excel, photos, fichier modèle. */
import { describe, expect, it } from "vitest";
import { cleFichier, dateIso, lireLot, MAX_LIGNES_LOT, modeleLot, type ChampLot } from "@/fonctionnalites/generation/lot";

const utf8 = (t: string) => new TextEncoder().encode(t);

const CHAMPS: ChampLot[] = [
  { nom: "nom", type: "texte", libelle: "Nom du paneliste", obligatoire: true },
  { nom: "poste", type: "texte", libelle: "Poste", obligatoire: false },
  { nom: "date", type: "date", libelle: "Date du panel", obligatoire: true },
  { nom: "participants", type: "nombre", libelle: "Participants", obligatoire: false },
  { nom: "progression", type: "jauge", libelle: "Progression", obligatoire: false },
  { nom: "photo", type: "image", libelle: "Photo", obligatoire: true },
];

describe("création par lot", () => {
  it("associe les colonnes par libellé ou par nom, avec leur famille, et ignore les autres", () => {
    const { colonnes } = lireLot(utf8("Nom du paneliste;DATE;photo;Participants;Progression;Titre du document;Remarque\nAwa;15/11/2026;awa.jpg;;;;\n"), CHAMPS);
    expect(colonnes.map((c) => [c.cible, c.famille])).toEqual([
      ["nom", "texte"],
      ["date", "calculee"],
      ["photo", "image"],
      ["participants", "calculee"],
      ["progression", "calculee"],
      ["titre", "autre"],
      [null, "autre"],
    ]);
  });

  it("lit chaque ligne : texte tel quel, valeurs calculées normalisées, photos et titre à part", () => {
    const csv = 'nom du paneliste;date du panel;participants;progression;photo;titre\n"Dr Awa Koné\nESATIC";samedi 15 novembre 2026;1 500;75 %;Photos\\Awa.JPG;Panel – Awa\nMoussa;46341;;;moussa.png;\n';
    const { lignes } = lireLot(utf8(csv), CHAMPS);
    expect(lignes[0]).toEqual({
      ligne: 2,
      titre: "Panel – Awa",
      valeurs: { nom: "Dr Awa Koné\nESATIC", date: "2026-11-15", participants: "1 500", progression: "75" },
      images: { photo: "Photos\\Awa.JPG" },
    });
    expect(lignes[1]).toMatchObject({ ligne: 3, titre: "", valeurs: { nom: "Moussa", date: "2026-11-15" }, images: { photo: "moussa.png" } });
  });

  it("convertit les dates telles qu'on les écrit, et laisse une date impossible au contrôle", () => {
    expect(dateIso("15/11/2026")).toBe("2026-11-15");
    expect(dateIso("5-3-26")).toBe("2026-03-05");
    expect(dateIso("2026-11-15")).toBe("2026-11-15");
    expect(dateIso("1er décembre 2026")).toBe("2026-12-01");
    expect(dateIso("31/02/2026")).toBe("31/02/2026");
    expect(dateIso("demain")).toBe("demain");
  });

  it("retrouve une photo par son nom, sans dossier, extension, accents ni casse", () => {
    expect(cleFichier("Photos\\Awa Koné.JPG")).toBe("awa_kone");
    expect(cleFichier("awa kone.webp")).toBe(cleFichier("AWA-KONE"));
  });

  it("refuse un fichier sans colonne obligatoire, avec une colonne en double, vide ou trop long", () => {
    expect(() => lireLot(utf8("nom;date\nAwa;15/11/2026\n"), CHAMPS)).toThrow(/manquante : « Photo »/);
    expect(() => lireLot(utf8("nom;Nom du paneliste;date;photo\nA;B;15/11/2026;a.jpg\n"), CHAMPS)).toThrow(/Deux colonnes remplissent « Nom du paneliste »/);
    expect(() => lireLot(utf8("nom;date;photo\n"), CHAMPS)).toThrow(/aucune ligne/);
    const long = "nom;date;photo\n" + Array.from({ length: MAX_LIGNES_LOT + 1 }, (_, i) => `M${i};15/11/2026;m${i}.jpg`).join("\n");
    expect(() => lireLot(utf8(long), CHAMPS)).toThrow(/au plus/);
  });

  it("produit un fichier modèle qui se relit sans erreur", () => {
    const modele = modeleLot(CHAMPS, { nom: "Dr Awa Koné", poste: "Directrice; ESATIC", date: "2026-11-15", participants: "125000", progression: "60" });
    expect(modele.split("\n")[0]).toBe("Nom du paneliste;Poste;Date du panel;Participants;Progression;Photo;Titre du document");
    const { lignes } = lireLot(utf8(modele), CHAMPS);
    expect(lignes).toHaveLength(2);
    expect(lignes[1]).toMatchObject({ valeurs: { nom: "Dr Awa Koné", poste: "Directrice; ESATIC", date: "2026-11-15" }, images: { photo: "photo-2.jpg" } });
  });
});
