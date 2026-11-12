/** Lecture du CSV de l'organigramme d'une activité (lot 10b). */
import { describe, expect, it } from "vitest";
import { lireOrganigramme, MODELE_ORGANIGRAMME, regrouperParCommission, roleEquipeEcrit } from "@/fonctionnalites/activites/organigramme-csv";

const csv = (t: string) => new TextEncoder().encode(t);

describe("organigramme : fichier CSV", () => {
  it("le fichier modèle se lit sans erreur, commissions dans l'ordre du fichier", () => {
    const lignes = lireOrganigramme(csv(MODELE_ORGANIGRAMME));
    expect(lignes.every((l) => !l.erreurs.length)).toBe(true);
    const groupes = regrouperParCommission(lignes);
    expect(groupes.map((g) => [g.nom, g.membres.length])).toEqual([
      ["Logistique", 3],
      ["Accueil", 2],
    ]);
    expect(groupes[0]!.membres[0]).toEqual({ role: "responsable", nom: "Koné Aïcha", telephone: "2250700000001" });
    expect(groupes[1]!.membres[1]!.telephone).toBeNull();
  });

  it("rôles écrits librement ; vide : membre", () => {
    expect(roleEquipeEcrit("Cheffe")).toBe("responsable");
    expect(roleEquipeEcrit("Responsable adjointe")).toBe("adjoint");
    expect(roleEquipeEcrit("")).toBe("membre");
    expect(roleEquipeEcrit("trésorier")).toBeNull();
  });

  it("erreurs ligne par ligne : commission, nom, numéro, rôle, responsable en double", () => {
    const lignes = lireOrganigramme(
      csv("Équipe,Fonction,Nom et prénoms,WhatsApp\nAccueil,Responsable,Awa,0700000001\naccueil,responsable,Ali,\n,Membre,Sans commission,\nAccueil,Trésorier,X,12\n"),
    );
    expect(lignes.map((l) => l.erreurs.length)).toEqual([0, 1, 1, 3]);
    expect(lignes[1]!.erreurs[0]).toMatch(/ligne 2/);
    expect(lignes[3]!.erreurs.join(" ")).toMatch(/Nom manquant.*Numéro invalide.*Rôle inconnu/);
  });

  it("fichier sans colonne commission ou sans personne : refusé", () => {
    expect(() => lireOrganigramme(csv("nom;telephone\nAwa;0700000001\n"))).toThrow(/commission/);
    expect(() => lireOrganigramme(csv("commission;nom\n"))).toThrow(/personne/);
  });
});
