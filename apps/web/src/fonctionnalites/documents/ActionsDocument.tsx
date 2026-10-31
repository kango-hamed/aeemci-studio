"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Loader2, Share2 } from "lucide-react";

const rien = () => () => {};

/** Le navigateur sait-il partager un fichier (téléphones surtout) ? Faux pendant le rendu serveur. */
function peutPartagerDesFichiers() {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([], "x.png", { type: "image/png" })] });
}

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "application/pdf": "pdf" };

/**
 * Téléchargements (réseaux, haute définition) et partage direct depuis un téléphone (WhatsApp…).
 * `plan` : déclinaison à servir quand ce n'est pas la principale. `hd` : absent pour un fichier déposé.
 */
export function ActionsDocument(p: { id: string; titre: string; plan?: string; type: string; libelle: string; hd?: { largeur: number; hauteur: number } }) {
  const partageable = useSyncExternalStore(rien, peutPartagerDesFichiers, () => false);
  const [partage, setPartage] = useState<"" | "en-cours" | "erreur">("");
  const [hd, setHd] = useState(false);
  const base = `/api/documents/${p.id}/fichier?${p.plan ? `plan=${encodeURIComponent(p.plan)}&` : ""}`;

  async function partager() {
    setPartage("en-cours");
    try {
      const blob = await (await fetch(base)).blob();
      await navigator.share({ files: [new File([blob], `${p.titre}.${EXTENSIONS[blob.type] ?? "bin"}`, { type: blob.type })], title: p.titre });
      setPartage("");
    } catch (e) {
      setPartage(e instanceof DOMException && e.name === "AbortError" ? "" : "erreur");
    }
  }

  const bouton = "flex min-h-12 items-center justify-center gap-2 rounded-m px-5 font-semibold no-underline";
  return (
    <div className="flex flex-col gap-3">
      <a href={`${base}telecharger=1`} className={`${bouton} bg-vert-esatic text-sur-vert`}>
        <Download size={20} aria-hidden />
        Télécharger · {p.libelle}
      </a>
      {p.hd && (
        <>
          <a href={`${base}qualite=hd&telecharger=1`} onClick={() => setHd(true)} className={`${bouton} border border-vert-esatic text-vert-esatic`}>
            {hd ? <Loader2 size={20} aria-hidden className="animate-spin" /> : <Download size={20} aria-hidden />}
            Haute définition · {p.hd.largeur} × {p.hd.hauteur}
          </a>
          <span className="text-sm leading-5 text-encre-douce">La haute définition sert à l&apos;impression ; la première fois, sa préparation prend quelques secondes.</span>
        </>
      )}
      {partageable && (
        <button type="button" onClick={() => void partager()} disabled={partage === "en-cours"} className={`${bouton} border border-trait-champ text-encre`}>
          {partage === "en-cours" ? <Loader2 size={20} aria-hidden className="animate-spin" /> : <Share2 size={20} aria-hidden />}
          Partager
        </button>
      )}
      {partage === "erreur" && <span role="alert" className="text-sm text-danger">Le partage a échoué : télécharge le fichier puis envoie-le.</span>}
    </div>
  );
}
