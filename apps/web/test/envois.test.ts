/**
 * Lettres en nombre (lot 7) : lecture du fichier des destinataires, variables, contrôle de l'envoi, archive zip.
 */
import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { blocDestinataire, controlerEnvoi, lettrePour, lireCsv, MAX_DESTINATAIRES, normaliserColonne, suffixeLettre, texteDuModele, variablesDe } from "@/fonctionnalites/administratif/envois";
import { titreParDefaut, definitionType } from "@/fonctionnalites/administratif/types";
import { creerZip } from "@/serveur/zip";

const utf8 = (t: string) => new TextEncoder().encode(t);

describe("fichier des destinataires", () => {
  it("lit un CSV d'Excel français : point-virgule, BOM, guillemets, retour à la ligne dans une cellule", () => {
    const csv = '﻿Civilité;Nom et prénoms;Qualité;Structure;Adresse\r\nMonsieur;Koné Ibrahim;Directeur Général;ESATIC;"Abidjan\nTreichville"\r\n;;;;\r\nMadame;"Traoré ""Awa""";Présidente;;\r\n';
    expect(lireCsv(utf8(csv))).toEqual([
      { civilite: "Monsieur", nom: "Koné Ibrahim", fonction: "Directeur Général", organisme: "ESATIC", adresse: "Abidjan\nTreichville" },
      { civilite: "Madame", nom: 'Traoré "Awa"', fonction: "Présidente" },
    ]);
  });

  it("accepte la virgule, la tabulation et l'encodage Windows-1252 ; garde les colonnes inconnues comme variables", () => {
    expect(lireCsv(utf8("nom,Montant demandé\nAwa,50 000\n"))).toEqual([{ nom: "Awa", montant_demande: "50 000" }]);
    expect(lireCsv(utf8("organisme\tville\nMairie\tTreichville\n"))).toEqual([{ organisme: "Mairie", adresse: "Treichville" }]);
    const cp1252 = Uint8Array.from([...utf8("nom\nKon"), 0xe9, 0x0a]);
    expect(lireCsv(cp1252)).toEqual([{ nom: "Koné" }]);
    expect(normaliserColonne(" Nom & Prénoms ")).toBe("nom");
    expect(normaliserColonne("Téléphone portable")).toBe("telephone_portable");
  });

  it("refuse un fichier sans nom ni organisme, vide, trop long ou avec une ligne anonyme", () => {
    expect(() => lireCsv(utf8("prenom;ville\nAwa;Abidjan\n"))).toThrow(/colonne « nom » ou « organisme »/);
    expect(() => lireCsv(utf8(""))).toThrow(/vide/);
    expect(() => lireCsv(utf8("nom\n"))).toThrow(/aucun destinataire/);
    expect(() => lireCsv(utf8("nom;fonction\nAwa;SG\n;Trésorier\n"))).toThrow(/Ligne 3/);
    expect(() => lireCsv(utf8("nom;Nom\nA;B\n"))).toThrow(/deux fois/);
    const long = "nom\n" + Array.from({ length: MAX_DESTINATAIRES + 1 }, (_, i) => `P${i}`).join("\n");
    expect(() => lireCsv(utf8(long))).toThrow(/au plus/);
  });
});

describe("lettre de chaque destinataire", () => {
  const liste: Record<string, string>[] = [
    { civilite: "Monsieur", nom: "Koné Ibrahim", fonction: "Directeur Général", organisme: "ESATIC" },
    { civilite: "Madame", nom: "Traoré Awa", organisme: "Mairie de Treichville" },
  ];
  const contenu = { objet: "Invitation", appel: "{civilite} {fonction},", corps: "Cher {nom}, …", pieces: "Programme" };

  it("compose le bloc d'adresse et remplace les variables", () => {
    expect(blocDestinataire(liste[0]!)).toBe("Monsieur Koné Ibrahim\nDirecteur Général\nESATIC");
    expect(lettrePour(contenu, liste[0]!)).toEqual({ ...contenu, destinataire: "Monsieur Koné Ibrahim\nDirecteur Général\nESATIC", appel: "Monsieur Directeur Général,", corps: "Cher Koné Ibrahim, …" });
    expect(variablesDe("{a} {b} {a} {B}")).toEqual(["a", "b"]);
  });

  it("signale la liste manquante, les variables sans colonne et les valeurs vides", () => {
    expect(controlerEnvoi(contenu, [])).toEqual([{ champ: "destinataires", message: expect.stringMatching(/importe la liste/) }]);
    expect(controlerEnvoi(contenu, liste)).toEqual([{ champ: "appel", message: expect.stringMatching(/\{fonction\} est vide pour un destinataire \(ligne 2/) }]);
    expect(controlerEnvoi({ ...contenu, appel: "Madame, Monsieur,", corps: "{montant}" }, liste)).toEqual([{ champ: "corps", message: expect.stringMatching(/\{montant\} ne correspond à aucune colonne/) }]);
    expect(controlerEnvoi({ ...contenu, appel: "{civilite}," }, liste)).toEqual([]);
  });

  it("numérote les lettres et titre l'envoi sans ses variables", () => {
    expect(suffixeLettre(7, 40)).toBe("07");
    expect(suffixeLettre(7, 100)).toBe("007");
    const t = definitionType("LET")!;
    expect(titreParDefaut(t, { objet: "Invitation de {nom}" }, true)).toBe("Lettres en nombre · Invitation de");
    expect(texteDuModele("invitation", { titre: "Conférence", quand: "samedi 14 novembre 2026 à 15 h", lieu: "Amphi A" }, "ESATIC").corps).toMatch(/^La Section ESATIC de l'AEEMCI organise « Conférence » le samedi 14 novembre 2026 à 15 h, Amphi A\./);
  });
});

describe("archive zip", () => {
  it("range chaque fichier sans compression, avec son CRC et son nom UTF-8", () => {
    const a = Buffer.from("%PDF-1 une");
    const b = Buffer.from("%PDF-1 deux");
    const zip = creerZip([
      { nom: "01-Koné.pdf", contenu: a },
      { nom: "02-Traoré.pdf", contenu: b },
    ]);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(14)).toBe(crc32(a));
    const nom = Buffer.from("01-Koné.pdf");
    expect(zip.subarray(30, 30 + nom.length).toString()).toBe("01-Koné.pdf");
    expect(zip.subarray(30 + nom.length, 30 + nom.length + a.length)).toEqual(a);
    const fin = zip.length - 22;
    expect(zip.readUInt32LE(fin)).toBe(0x06054b50);
    expect(zip.readUInt16LE(fin + 10)).toBe(2);
    const central = zip.readUInt32LE(fin + 16);
    expect(zip.readUInt32LE(central)).toBe(0x02014b50);
    // Deuxième entrée du répertoire central : position de son en-tête local.
    const second = central + 46 + nom.length;
    expect(zip.readUInt32LE(zip.readUInt32LE(second + 42))).toBe(0x04034b50);
  });
});
