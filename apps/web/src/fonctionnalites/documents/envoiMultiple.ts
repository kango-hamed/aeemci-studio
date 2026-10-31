import { preparer } from "./FormulaireDepot";

export interface BilanEnvoi {
  envoyes: number;
  echecs: { nom: string; message: string }[];
}

/**
 * Dépose plusieurs fichiers l'un après l'autre (photos d'une activité, anciens dossiers) par
 * `/api/documents/depots`, avec les mêmes champs pour tous. Un échec n'arrête pas les suivants.
 */
export async function envoyerFichiers(fichiers: File[], champs: Record<string, string>, progression: (fait: number) => void): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { envoyes: 0, echecs: [] };
  for (const [i, f] of fichiers.entries()) {
    try {
      const p = await preparer(f);
      if (p.apercu) URL.revokeObjectURL(p.apercu);
      const corps = new FormData();
      corps.append("fichier", p.fichier, p.nom);
      if (p.miniature) corps.append("miniature", p.miniature, "miniature.jpg");
      if (p.largeur) corps.append("largeur", String(p.largeur));
      if (p.hauteur) corps.append("hauteur", String(p.hauteur));
      for (const [k, v] of Object.entries(champs)) if (v) corps.append(k, v);
      const r = await fetch("/api/documents/depots", { method: "POST", body: corps });
      if (r.ok) bilan.envoyes++;
      else bilan.echecs.push({ nom: f.name, message: (await r.json().catch(() => null))?.message ?? "Dépôt refusé." });
    } catch (e) {
      bilan.echecs.push({ nom: f.name, message: e instanceof Error ? e.message : "Fichier illisible." });
    }
    progression(i + 1);
  }
  return bilan;
}
