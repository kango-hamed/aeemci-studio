"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, FileText, FolderOpen, Loader2, Upload } from "lucide-react";
import { ChampsPartage } from "./ChampsPartage";

const TAILLE_MAX = 20 * 1024 * 1024;
const TYPES_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const COTE_MAX = 4000;
const COTE_MINIATURE = 360;
const champ = "min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

interface Prepare {
  fichier: Blob;
  nom: string;
  apercu: string | null;
  miniature: Blob | null;
  largeur?: number;
  hauteur?: number;
}

function enJpeg(image: ImageBitmap, cote: number, qualite: number): Promise<{ blob: Blob; largeur: number; hauteur: number }> {
  const echelle = Math.min(1, cote / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // fond blanc : un PNG transparent ne devient pas noir en JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, ko) =>
    canvas.toBlob((b) => (b ? ok({ blob: b, largeur: canvas.width, hauteur: canvas.height }) : ko(new Error("Conversion impossible"))), "image/jpeg", qualite),
  );
}

/**
 * Prépare le fichier dans le navigateur : un PDF part tel quel ; une photo d'un format que le serveur
 * ne lit pas (HEIC de l'iPhone…) ou trop grande devient un JPEG, et reçoit sa miniature.
 */
async function preparer(f: File): Promise<Prepare> {
  if (f.type === "application/pdf") {
    if (f.size > TAILLE_MAX) throw new Error("PDF trop lourd (20 Mo au plus).");
    return { fichier: f, nom: f.name, apercu: null, miniature: null };
  }
  if (!f.type.startsWith("image/")) throw new Error("Format non pris en charge : dépose un PDF ou une image.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(f, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Cette image ne peut pas être lue par le navigateur : enregistre-la en JPEG ou en PNG.");
  }
  const convertir = !TYPES_IMAGE.includes(f.type) || f.size > TAILLE_MAX || Math.max(image.width, image.height) > COTE_MAX;
  const principal = convertir ? await enJpeg(image, COTE_MAX, 0.9) : null;
  const miniature = await enJpeg(image, COTE_MINIATURE, 0.8);
  const fichier = principal?.blob ?? f;
  const nom = principal ? f.name.replace(/\.[^.]+$/, "") + ".jpg" : f.name;
  return {
    fichier,
    nom,
    apercu: URL.createObjectURL(fichier),
    miniature: miniature.blob,
    largeur: principal?.largeur ?? image.width,
    hauteur: principal?.hauteur ?? image.height,
  };
}

export function FormulaireDepot({ aUneDelegation }: { aUneDelegation: boolean }) {
  const router = useRouter();
  const [prepare, setPrepare] = useState<Prepare | null>(null);
  const [titre, setTitre] = useState("");
  const [etat, setEtat] = useState<"" | "preparation" | "envoi">("");
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(f: File | undefined) {
    if (!f) return;
    setErreur(null);
    setEtat("preparation");
    try {
      const p = await preparer(f);
      setPrepare((avant) => {
        if (avant?.apercu) URL.revokeObjectURL(avant.apercu);
        return p;
      });
      setTitre((t) => t || f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Fichier illisible.");
    }
    setEtat("");
  }

  async function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!prepare) {
      setErreur("Choisis d'abord un fichier ou prends une photo.");
      return;
    }
    const partage = new FormData(e.currentTarget);
    const corps = new FormData();
    corps.append("fichier", prepare.fichier, prepare.nom);
    if (prepare.miniature) corps.append("miniature", prepare.miniature, "miniature.jpg");
    if (prepare.largeur) corps.append("largeur", String(prepare.largeur));
    if (prepare.hauteur) corps.append("hauteur", String(prepare.hauteur));
    corps.append("titre", titre);
    corps.append("visibilite", String(partage.get("visibilite") ?? ""));
    corps.append("statut", partage.get("brouillon") ? "brouillon" : "publie");
    setEtat("envoi");
    setErreur(null);
    try {
      const r = await fetch("/api/documents/depots", { method: "POST", body: corps });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        router.push(`/documents/${json.id}`);
        return;
      }
      setErreur(json.message ?? "Dépôt impossible.");
    } catch {
      setErreur("Connexion perdue : réessaie dans un instant.");
    }
    setEtat("");
  }

  const bouton =
    "relative flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-vert-esatic";

  return (
    <form onSubmit={envoyer} noValidate className="flex max-w-[640px] flex-col gap-6">
      {erreur && (
        <p role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
          <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
          {erreur}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
        <div className="flex items-center gap-4">
          {prepare?.apercu ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) du fichier choisi
            <img src={prepare.apercu} alt="" className="size-20 shrink-0 rounded-s object-cover" />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-s bg-creme text-orange-texte">
              {etat === "preparation" ? <Loader2 size={28} aria-hidden className="animate-spin" /> : <FileText size={28} aria-hidden />}
            </span>
          )}
          <span className="flex min-w-0 flex-col text-sm leading-5" aria-live="polite">
            <span className="truncate font-semibold">{prepare?.nom ?? "Aucun fichier"}</span>
            <span className="text-encre-douce">
              {etat === "preparation" ? "Préparation…" : prepare ? `${(prepare.fichier.size / 1024 / 1024).toFixed(1).replace(".", ",")} Mo · prêt` : "PDF ou image, 20 Mo au plus"}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={bouton}>
            <Camera size={18} aria-hidden />
            Prendre en photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void choisir(e.target.files?.[0])} />
          </label>
          <label className={bouton}>
            <FolderOpen size={18} aria-hidden />
            Choisir un fichier
            <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => void choisir(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="depot-titre" className="font-semibold">
          Titre
        </label>
        <input id="depot-titre" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={200} placeholder="Ex. : PV de l'assemblée générale du 12 octobre" className={champ} />
      </div>

      <ChampsPartage prefixe="depot" aUneDelegation={aUneDelegation} />

      <button
        type="submit"
        disabled={etat !== ""}
        className="flex min-h-12 items-center justify-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70"
      >
        {etat === "envoi" ? <Loader2 size={20} aria-hidden className="animate-spin" /> : <Upload size={20} aria-hidden />}
        {etat === "envoi" ? "Envoi…" : "Déposer le document"}
      </button>
    </form>
  );
}
