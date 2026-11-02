/** Lecture du fichier d'import du bureau : colonnes, rôles écrits librement, erreurs par ligne. */
import { describe, expect, it } from "vitest";
import { lireImport, MAX_LIGNES_IMPORT, MODELE_IMPORT, roleEcrit } from "@/fonctionnalites/organisation/import-membres";

const utf8 = (t: string) => new TextEncoder().encode(t);

describe("import des membres", () => {
  it("lit le modèle : rôles, délégations, codes, designer", () => {
    const lignes = lireImport(utf8(MODELE_IMPORT));
    expect(lignes.map((l) => [l.ligne, l.role, l.delegation, l.code, l.designer, l.erreurs])).toEqual([
      [2, "vice_president", "", "", false, []],
      [3, "responsable_delegation", "Cellule communication", "COM", true, []],
      [4, "membre", "Cellule communication", "", false, []],
      [5, "responsable_delegation", "Délégation culturelle", "CULT", false, []],
    ]);
  });

  it("reconnaît les intitulés et les rôles tels qu'on les écrit", () => {
    const [l] = lireImport(utf8("Nom et prénoms,Adresse e-mail,Poste,Cellule\n  Awa  Koné ,AWA@Esatic.edu.ci,Secrétaire Générale,Com\n"));
    expect(l).toMatchObject({ nom: "Awa Koné", email: "awa@esatic.edu.ci", role: "secretaire_general", delegation: "", erreurs: [] });
    expect(roleEcrit("Présidente")).toBe("president");
    expect(roleEcrit("chef de délégation")).toBe("responsable_delegation");
    expect(roleEcrit("")).toBe("membre");
    expect(roleEcrit("trésorier")).toBeNull();
  });

  it("signale les erreurs de chaque ligne sans arrêter la lecture", () => {
    const csv = "nom;email;role;delegation;designer\nAwa;awa@esatic.edu.ci;Membre;;\nMoussa;pas-une-adresse;Membre;Com;\nFatou;AWA@esatic.edu.ci;Trésorier;Com;peut-être\n";
    const [a, b, c] = lireImport(utf8(csv));
    expect(a!.erreurs).toEqual([expect.stringMatching(/Délégation manquante/)]);
    expect(b!.erreurs).toEqual([expect.stringMatching(/E-mail invalide/)]);
    expect(c!.erreurs).toEqual([expect.stringMatching(/déjà à la ligne 2/), expect.stringMatching(/Rôle inconnu/), expect.stringMatching(/Designer/)]);
  });

  it("refuse un fichier sans les colonnes requises, vide ou trop long", () => {
    expect(() => lireImport(utf8("nom;role\nAwa;Membre\n"))).toThrow(/colonne « email »/);
    expect(() => lireImport(utf8(""))).toThrow(/vide/);
    expect(() => lireImport(utf8("nom;email\n"))).toThrow(/aucun membre/);
    expect(() => lireImport(utf8("nom;email;mail\nA;a@b.ci;c@d.ci\n"))).toThrow(/deux fois/);
    const long = "nom;email\n" + Array.from({ length: MAX_LIGNES_IMPORT + 1 }, (_, i) => `M${i};m${i}@esatic.edu.ci`).join("\n");
    expect(() => lireImport(utf8(long))).toThrow(/au plus/);
  });
});
