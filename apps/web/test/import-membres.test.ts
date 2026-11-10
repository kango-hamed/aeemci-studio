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
    expect(roleEcrit("Sous-responsable")).toBe("sous_responsable_delegation");
    expect(roleEcrit("Responsable adjointe")).toBe("sous_responsable_delegation");
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

  it("accepte un membre sans e-mail s'il a un numéro, écrit comme on veut", () => {
    const csv = [
      "nom;email;contact;role",
      "Awa;;07 69 89 37 40;Vice-présidente",
      "Moussa;moussa@esatic.edu.ci;+225 05 86 10 66 13;Vice-président",
      "Fatou;;https://wa.me/2250143829046;Vice-présidente",
      "Ali;;;Vice-président",
      "Inès;;07037828419;Vice-présidente",
      "Yao;;0769893740;Vice-président",
      "Sita;sita@esatic.edu.ci;0769893740;Vice-présidente",
    ].join("\n");
    const lignes = lireImport(utf8(csv));
    expect(lignes.map((l) => [l.email, l.telephone, l.erreurs])).toEqual([
      ["", "2250769893740", []],
      ["moussa@esatic.edu.ci", "2250586106613", []],
      ["", "2250143829046", []],
      ["", "", [expect.stringMatching(/E-mail manquant/)]],
      ["", "", [expect.stringMatching(/Numéro invalide : « 07037828419 »/)]],
      ["", "2250769893740", [expect.stringMatching(/Numéro déjà à la ligne 2/)]],
      // Avec un e-mail, le numéro peut être partagé : c'est l'e-mail qui désigne le compte.
      ["sita@esatic.edu.ci", "2250769893740", []],
    ]);
    // Un chiffre de trop se voit aussi dans une adresse wa.me ; un numéro étranger garde son indicatif.
    expect(lireImport(utf8("nom;whatsapp;role\nInès;https://wa.me/22507037828419;Vice-présidente\nLéa;+33 6 12 34 56 78;Vice-présidente\n")).map((l) => [l.telephone, l.erreurs.length])).toEqual([
      ["", 1],
      ["33612345678", 0],
    ]);
    // Une colonne de numéros suffit, sans colonne d'e-mails.
    expect(lireImport(utf8("nom;telephone\nAwa;0769893740\n"))[0]).toMatchObject({ email: "", telephone: "2250769893740", erreurs: [expect.stringMatching(/Délégation/)] });
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
