"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ImagePlus, Loader2 } from "lucide-react";
import { envoyerFichiers, type BilanEnvoi } from "./envoiMultiple";

/**
 * Sélection et envoi de plusieurs fichiers d'un coup. `champs` : rattachement commun (activité, mandat…),
 * ou fonction qui le prépare juste avant l'envoi (création d'un mandat passé…) et renvoie un message d'erreur.
 */
export function ChoixFichiers(p: {
  id: string;
  libelle: string;
  accept: string;
  capture?: boolean;
  champs: Record<string, string> | (() => Promise<Record<string, string> | string>);
}) {
  const router = useRouter();
  const [progression, setProgression] = useState<{ fait: number; total: number } | null>(null);
  const [bilan, setBilan] = useState<BilanEnvoi | null>(null);
  const [erreur, setErreur] = useState("");

  async function envoyer(liste: FileList | null) {
    const fichiers = [...(liste ?? [])];
    if (!fichiers.length) return;
    setErreur("");
    setBilan(null);
    const champs = typeof p.champs === "function" ? await p.champs() : p.champs;
    if (typeof champs === "string") {
      setErreur(champs);
      return;
    }
    setProgression({ fait: 0, total: fichiers.length });
    const b = await envoyerFichiers(fichiers, champs, (fait) => setProgression({ fait, total: fichiers.length }));
    setProgression(null);
    setBilan(b);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={p.id}
        className={
          "flex min-h-12 cursor-pointer items-center justify-center gap-2 self-start rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-vert-esatic " +
          (progression ? "pointer-events-none opacity-70" : "")
        }
      >
        {progression ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <ImagePlus size={18} aria-hidden />}
        {progression ? `Envoi ${progression.fait} / ${progression.total}…` : p.libelle}
        <input
          id={p.id}
          type="file"
          multiple
          accept={p.accept}
          {...(p.capture ? { capture: "environment" as const } : {})}
          disabled={Boolean(progression)}
          className="sr-only"
          onChange={(e) => {
            void envoyer(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p role="status" aria-live="polite" className="m-0 text-sm text-encre-douce">
        {bilan && bilan.envoyes > 0 && `${bilan.envoyes} fichier${bilan.envoyes > 1 ? "s" : ""} ajouté${bilan.envoyes > 1 ? "s" : ""}.`}
      </p>
      {(erreur || (bilan && bilan.echecs.length > 0)) && (
        <div role="alert" className="flex gap-2 rounded-m bg-fond-danger p-3 text-sm text-danger">
          <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
          <div>
            {erreur && <p className="m-0">{erreur}</p>}
            {bilan?.echecs.map((x) => (
              <p key={x.nom} className="m-0">
                {x.nom} : {x.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
