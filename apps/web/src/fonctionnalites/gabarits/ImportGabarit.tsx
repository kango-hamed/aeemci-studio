"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FolderUp, Loader2 } from "lucide-react";

const UTILES = /(^|\/)(gabarit\.publie\.json|manifest\.json)$|\.(png|jpe?g|webp)$/i;
const IGNORES = /(^|\/)(source|exports)\//i;
const TAILLE_MAX = 30 * 1024 * 1024;

interface Resultat {
  gabaritId: string;
  numero: number;
  nom: string;
  nouveau: boolean;
  remarques: string[];
}

function mo(o: number) {
  return `${(o / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** Envoi du dossier d'un gabarit publié par l'atelier (manifest, gabarit.publie.json, fonds et couches). */
export function ImportGabarit() {
  const champ = useRef<HTMLInputElement>(null);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [etat, setEtat] = useState<{ envoi?: boolean; erreur?: string; details?: string[]; resultat?: Resultat }>({});

  useEffect(() => {
    champ.current?.setAttribute("webkitdirectory", "");
  }, []);

  // Le PSD source et les exports du plugin ne servent pas au rendu : on ne les envoie pas.
  const retenus = fichiers.filter((f) => UTILES.test(f.webkitRelativePath || f.name) && !IGNORES.test(f.webkitRelativePath || f.name));
  const total = retenus.reduce((t, f) => t + f.size, 0);
  const publie = retenus.some((f) => /(^|\/)gabarit\.publie\.json$/.test(f.webkitRelativePath || f.name));

  async function envoyer() {
    setEtat({ envoi: true });
    const corps = new FormData();
    for (const f of retenus) {
      corps.append("chemin", f.webkitRelativePath || f.name);
      corps.append("fichier", f);
    }
    try {
      const r = await fetch("/api/gabarits", { method: "POST", body: corps });
      const json = await r.json().catch(() => ({ message: "Réponse illisible du serveur." }));
      setEtat(r.ok ? { resultat: json } : { erreur: json.message ?? "Import impossible.", details: json.details });
    } catch {
      setEtat({ erreur: "Connexion perdue pendant l'envoi." });
    }
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-6">
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
          Le dossier produit par le plugin Photoshop, après publication dans l&apos;atelier : il contient <code>manifest.json</code>,{" "}
          <code>gabarit.publie.json</code> et le sous-dossier <code>gabarit</code>. Le PSD n&apos;est pas envoyé.
        </span>
      </div>

      {fichiers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-5">
          <p className="m-0">
            <strong>{retenus.length} fichiers</strong> à envoyer · {mo(total)}
          </p>
          {!publie && (
            <p className="m-0 flex gap-2 rounded-m bg-fond-attention p-3 text-sm leading-5 text-attention">
              <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
              Pas de <code>gabarit.publie.json</code> dans ce dossier : ouvre-le d&apos;abord dans l&apos;atelier et clique sur « Publier ».
            </p>
          )}
          {total > TAILLE_MAX && <p className="m-0 text-sm text-danger">Trop lourd : 30 Mo au plus. Exporte le fond en PNG optimisé depuis le plugin.</p>}
          <button
            type="button"
            onClick={() => void envoyer()}
            disabled={!publie || total > TAILLE_MAX || etat.envoi}
            className="flex min-h-12 items-center justify-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-60"
          >
            {etat.envoi && <Loader2 size={20} aria-hidden className="animate-spin" />}
            {etat.envoi ? "Import en cours…" : "Importer le gabarit"}
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
        {etat.resultat && (
          <div className="flex flex-col gap-2 rounded-m bg-fond-succes p-4 text-succes">
            <p className="m-0 flex gap-2 font-semibold">
              <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" />
              {etat.resultat.nouveau ? `« ${etat.resultat.nom} » est disponible pour les membres.` : `« ${etat.resultat.nom} » : révision ${etat.resultat.numero} en ligne.`}
            </p>
            {etat.resultat.remarques.length > 0 && (
              <ul className="m-0 pl-8 text-sm leading-5 text-encre">
                {etat.resultat.remarques.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <Link href={`/creer/${etat.resultat.gabaritId}`} className="font-semibold">
              Essayer le gabarit
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
