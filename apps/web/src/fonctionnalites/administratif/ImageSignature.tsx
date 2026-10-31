"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Camera, Loader2, Save } from "lucide-react";

const COTE_MAX = 1200;
const MARGE = 12;

/**
 * Détoure une photo de signature ou de cachet : le papier (pixels clairs) devient transparent,
 * l'encre garde sa couleur, puis l'image est recadrée au plus près du tracé. Sortie PNG.
 */
async function detourer(f: File): Promise<Blob> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(f, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Cette image ne peut pas être lue : prends la photo en JPEG ou en PNG.");
  }
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const l = Math.round(image.width * echelle);
  const h = Math.round(image.height * echelle);
  const source = document.createElement("canvas");
  source.width = l;
  source.height = h;
  const ctx = source.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, l, h);
  const pixels = ctx.getImageData(0, 0, l, h);
  const d = pixels.data;
  let [x0, y0, x1, y1] = [l, h, -1, -1];
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    // Au-dessus de 210 : papier ; en dessous de 150 : encre ; entre les deux, transparence progressive.
    const alpha = lum >= 210 ? 0 : lum <= 150 ? 255 : Math.round((255 * (210 - lum)) / 60);
    d[i + 3] = Math.min(d[i + 3]!, alpha);
    if (d[i + 3]! > 40) {
      const p = i / 4;
      const x = p % l;
      const y = (p - x) / l;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("Aucun tracé trouvé : l'image semble vide ou trop claire.");
  ctx.putImageData(pixels, 0, 0);
  x0 = Math.max(0, x0 - MARGE);
  y0 = Math.max(0, y0 - MARGE);
  x1 = Math.min(l - 1, x1 + MARGE);
  y1 = Math.min(h - 1, y1 + MARGE);
  const sortie = document.createElement("canvas");
  sortie.width = x1 - x0 + 1;
  sortie.height = y1 - y0 + 1;
  sortie.getContext("2d")!.drawImage(source, x0, y0, sortie.width, sortie.height, 0, 0, sortie.width, sortie.height);
  return new Promise((ok, ko) => sortie.toBlob((b) => (b ? ok(b) : ko(new Error("Conversion impossible"))), "image/png"));
}

/** Choix, détourage et envoi d'une signature (ou du cachet de la section). */
export function ImageSignature(p: { quoi: "signature" | "cachet"; titre: string; aide: string; actuelle: string | null }) {
  const router = useRouter();
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [etat, setEtat] = useState<"" | "preparation" | "envoi" | "ok">("");
  const [erreur, setErreur] = useState("");
  const id = `fichier-${p.quoi}`;

  async function choisir(f: File | undefined) {
    if (!f) return;
    setErreur("");
    setEtat("preparation");
    try {
      const blob = await detourer(f);
      if (image) URL.revokeObjectURL(image.url);
      setImage({ blob, url: URL.createObjectURL(blob) });
      setEtat("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Image illisible.");
      setEtat("");
    }
  }

  async function enregistrer() {
    if (!image) return;
    setEtat("envoi");
    setErreur("");
    const form = new FormData();
    form.set("quoi", p.quoi);
    form.set("image", image.blob, `${p.quoi}.png`);
    const r = await fetch("/api/signature", { method: "POST", body: form }).catch(() => null);
    if (!r?.ok) {
      setErreur((await r?.json().catch(() => null))?.message ?? "Envoi impossible : vérifie ta connexion.");
      setEtat("");
      return;
    }
    URL.revokeObjectURL(image.url);
    setImage(null);
    setEtat("ok");
    router.refresh();
  }

  const apercu = image?.url ?? p.actuelle;
  return (
    <section aria-labelledby={`titre-${p.quoi}`} className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
      <h2 id={`titre-${p.quoi}`} className="titre-3 m-0">
        {p.titre}
      </h2>
      <p className="m-0 text-sm text-encre-douce">{p.aide}</p>
      <div className="flex min-h-40 items-center justify-center rounded-m border border-dashed border-trait-champ bg-white p-4">
        {apercu ? (
          // eslint-disable-next-line @next/next/no-img-element -- image privée ou locale (aperçu avant envoi)
          <img src={apercu} alt={image ? `Aperçu détouré : ${p.titre.toLowerCase()}` : `${p.titre} enregistrée`} className="max-h-40 max-w-full object-contain" />
        ) : (
          <span className="text-sm text-encre-douce">Aucune image enregistrée.</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={id}
          className="flex min-h-12 cursor-pointer items-center gap-2 rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-vert-esatic"
        >
          {etat === "preparation" ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Camera size={18} aria-hidden />}
          {p.actuelle || image ? "Choisir une autre photo" : "Choisir une photo"}
          <input id={id} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => choisir(e.target.files?.[0])} />
        </label>
        {image && (
          <button type="button" onClick={enregistrer} disabled={etat === "envoi"} className="flex min-h-12 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-70">
            {etat === "envoi" ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Save size={18} aria-hidden />}
            Enregistrer
          </button>
        )}
      </div>
      {erreur && (
        <p role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3 text-sm text-danger">
          <AlertTriangle size={18} aria-hidden className="shrink-0" />
          {erreur}
        </p>
      )}
      {etat === "ok" && (
        <p role="status" className="m-0 text-sm text-succes">
          Enregistré. Les documents déjà validés gardent l&apos;ancienne image.
        </p>
      )}
    </section>
  );
}
