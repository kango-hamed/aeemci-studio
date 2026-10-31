"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FolderUp, Loader2 } from "lucide-react";

const UTILES = /(^|\/)(gabarit\.publie\.json|manifest\.json)$|\.(png|jpe?g|webp)$/i;
const IGNORES = /(^|\/)(source|exports)\//i;
const TAILLE_MAX = 30 * 1024 * 1024;

function mo(o: number) {
  if (o < 1024 * 1024) return `${Math.max(1, Math.round(o / 1024)).toLocaleString("fr-FR")} Ko`;
  return `${(o / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Envoi du dossier produit par le plugin Photoshop (manifest, fonds et couches), pour un nouveau gabarit
 * ou comme nouvelle version d'un gabarit existant. Le brouillon créé s'ouvre ensuite dans son écran.
 */
export function ImportGabarit({ gabarits, cible }: { gabarits: { id: string; nom: string }[]; cible?: string }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [gabaritId, setGabaritId] = useState(cible ?? "");
  const [etat, setEtat] = useState<{ envoi?: boolean; erreur?: string; details?: string[] }>({});

  useEffect(() => {
    champ.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Le PSD source et les exports du plugin ne servent pas au rendu : on ne les envoie pas.
  const retenus = fichiers.filter((f) => UTILES.test(f.webkitRelativePath || f.name) && !IGNORES.test(f.webkitRelativePath || f.name));
  const total = retenus.reduce((t, f) => t + f.size, 0);
  const lisible = retenus.some((f) => /(^|\/)(manifest|gabarit\.publie)\.json$/.test(f.webkitRelativePath || f.name));

  async function envoyer() {
    setEtat({ envoi: true });
    const corps = new FormData();
    if (gabaritId) corps.set("gabaritId", gabaritId);
    for (const f of retenus) {
      corps.append("chemin", f.webkitRelativePath || f.name);
      corps.append("fichier", f);
    }
    try {
      const r = await fetch("/api/gabarits", { method: "POST", body: corps });
      const json = await r.json().catch(() => ({ message: "Réponse illisible du serveur." }));
      if (r.ok) router.push(`/gabarits/${json.gabaritId}/reglages`);
      else setEtat({ erreur: json.message ?? "Import impossible.", details: json.details });
    } catch {
      setEtat({ erreur: "Connexion perdue pendant l'envoi." });
    }
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-cible" className="font-semibold">
          Gabarit concerné
        </label>
        <select id="import-cible" value={gabaritId} onChange={(e) => setGabaritId(e.target.value)} className="min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre">
          <option value="">Nouveau gabarit (ou même nom qu&apos;un existant)</option>
          {gabarits.map((g) => (
            <option key={g.id} value={g.id}>
              Nouvelle version de « {g.nom} »
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <span id="dossier-libelle" className="font-semibold">
          Dossier du gabarit
        </span>
        <label className="flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-vert-esatic">
          <FolderUp size={20} aria-hidden />
          Choisir le dossier
          <input
            ref={champ}
            type="file"
            multiple
            aria-labelledby="dossier-libelle"
            aria-describedby="dossier-aide"
            className="sr-only"
            onChange={(e) => {
              setFichiers([...(e.target.files ?? [])]);
              setEtat({});
            }}
          />
        </label>
        <span id="dossier-aide" className="text-sm leading-5 text-encre-douce">
          Le dossier produit par le plugin Photoshop : il contient <code>manifest.json</code> et le sous-dossier <code>gabarit</code>. Le PSD n&apos;est
          pas envoyé.
        </span>
      </div>

      {fichiers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-5">
          <p className="m-0">
            <strong>{retenus.length} fichiers</strong> à envoyer · {mo(total)}
          </p>
          {!lisible && (
            <p className="m-0 flex gap-2 rounded-m bg-fond-attention p-3 text-sm leading-5 text-attention">
              <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
              Pas de <code>manifest.json</code> dans ce dossier : choisis le dossier produit par le plugin Photoshop.
            </p>
          )}
          {total > TAILLE_MAX && <p className="m-0 text-sm text-danger">Trop lourd : 30 Mo au plus. Exporte le fond en PNG optimisé depuis le plugin.</p>}
          <button
            type="button"
            onClick={() => void envoyer()}
            disabled={!lisible || total > TAILLE_MAX || etat.envoi}
            className="flex min-h-12 items-center justify-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-60"
          >
            {etat.envoi && <Loader2 size={20} aria-hidden className="animate-spin" />}
            {etat.envoi ? "Import en cours…" : "Importer et régler"}
          </button>
        </div>
      )}

      <div aria-live="polite">
        {etat.erreur && (
          <div role="alert" className="flex flex-col gap-2 rounded-m bg-fond-danger p-4 text-danger">
            <p className="m-0 flex gap-2 font-semibold">
              <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
              {etat.erreur}
            </p>
            {etat.details?.length ? (
              <ul className="m-0 pl-8 text-sm leading-5">
                {etat.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
