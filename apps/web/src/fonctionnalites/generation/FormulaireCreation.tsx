"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, ImagePlus, Loader2 } from "lucide-react";

export interface ChampFormulaire {
  nom: string;
  type: "texte" | "date" | "nombre" | "image" | "jauge";
  libelle: string;
  aide?: string;
  obligatoire: boolean;
  maxCaracteres?: number;
  min?: number;
  max?: number;
  /** Plusieurs lignes possibles (zone de paragraphe). */
  multiligne: boolean;
}

export interface PlanFormulaire {
  plan: string;
  largeur: number;
  hauteur: number;
}

interface RapportZone {
  champ: string;
  reduit?: boolean;
  coupe?: boolean;
  depasse?: boolean;
}

type Valeur = string | null;

const champ = "min-h-12 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre aria-invalid:border-danger";
const DELAI_APERCU = 450;
const COTE_MAX_PHOTO = 2000;

/** Réduit la photo dans le navigateur avant l'envoi : moins de données mobiles, envoi plus rapide. */
async function reduirePhoto(f: File): Promise<Blob> {
  const image = await createImageBitmap(f, { imageOrientation: "from-image" });
  const echelle = Math.min(1, COTE_MAX_PHOTO / Math.max(image.width, image.height));
  if (echelle === 1 && f.type === "image/jpeg" && f.size < 3_000_000) return f;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * echelle);
  canvas.height = Math.round(image.height * echelle);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error("Conversion impossible"))), "image/jpeg", 0.9));
}

function formatPlan(p: PlanFormulaire) {
  const r = p.hauteur / p.largeur;
  const genre = r > 1.6 ? "Story" : r > 1.1 ? "Affiche" : r > 0.9 ? "Carré" : "Paysage";
  return `${genre} · ${p.largeur} × ${p.hauteur}`;
}

export function FormulaireCreation({ gabaritId, revisionId, champs, plans }: { gabaritId: string; revisionId: string; champs: ChampFormulaire[]; plans: PlanFormulaire[] }) {
  const router = useRouter();
  const [valeurs, setValeurs] = useState<Record<string, Valeur>>({});
  const [photos, setPhotos] = useState<Record<string, { url: string; nom: string; envoi: boolean; erreur?: string }>>({});
  const [plan, setPlan] = useState(plans[0]!.plan);
  const [apercu, setApercu] = useState<{ url: string | null; chargement: boolean; erreur?: string; rapport: RapportZone[] }>({ url: null, chargement: true, rapport: [] });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const sequence = useRef(0);

  const changer = (nom: string, v: Valeur) => {
    setValeurs((a) => ({ ...a, [nom]: v }));
    setErreurs((e) => {
      if (!e[nom]) return e;
      const reste = { ...e };
      delete reste[nom];
      return reste;
    });
  };

  // Aperçu : relancé après une pause dans la saisie ; une réponse dépassée par une plus récente est ignorée.
  const demanderApercu = useCallback(async (v: Record<string, Valeur>, p: string) => {
    const n = ++sequence.current;
    setApercu((a) => ({ ...a, chargement: true }));
    try {
      const r = await fetch("/api/apercus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gabaritId, plan: p, valeurs: v }) });
      if (n !== sequence.current) return;
      if (!r.ok) {
        const corps = await r.json().catch(() => ({}));
        setApercu((a) => ({ ...a, chargement: false, erreur: corps.message ?? "Aperçu impossible." }));
        return;
      }
      const rapport = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.headers.get("x-rapport") ?? "W10="), (c) => c.charCodeAt(0)))) as RapportZone[];
      const url = URL.createObjectURL(await r.blob());
      setApercu((a) => {
        if (a.url) URL.revokeObjectURL(a.url);
        return { url, chargement: false, rapport };
      });
    } catch {
      if (n === sequence.current) setApercu((a) => ({ ...a, chargement: false, erreur: "Connexion perdue : l'aperçu n'a pas pu être mis à jour." }));
    }
  }, [gabaritId]);

  useEffect(() => {
    const t = setTimeout(() => void demanderApercu(valeurs, plan), DELAI_APERCU);
    return () => clearTimeout(t);
  }, [valeurs, plan, demanderApercu]);

  async function choisirPhoto(nom: string, f: File | undefined) {
    if (!f) return;
    const locale = URL.createObjectURL(f);
    setPhotos((p) => ({ ...p, [nom]: { url: locale, nom: f.name, envoi: true } }));
    try {
      const corps = new FormData();
      corps.append("photo", await reduirePhoto(f), f.name.replace(/\.[^.]+$/, "") + ".jpg");
      const r = await fetch("/api/televersements", { method: "POST", body: corps });
      const json = await r.json();
      if (!r.ok) throw new Error(json.message ?? "Envoi impossible.");
      setPhotos((p) => ({ ...p, [nom]: { url: locale, nom: f.name, envoi: false } }));
      changer(nom, `televersement:${json.id}`);
    } catch (e) {
      setPhotos((p) => ({ ...p, [nom]: { url: locale, nom: f.name, envoi: false, erreur: e instanceof Error ? e.message : "Envoi impossible." } }));
    }
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const manquants: Record<string, string> = {};
    for (const c of champs) if (c.obligatoire && !valeurs[c.nom]?.toString().trim()) manquants[c.nom] = `« ${c.libelle} » est obligatoire.`;
    if (Object.keys(manquants).length) {
      setErreurs(manquants);
      setMessage("Complète les champs signalés.");
      document.getElementById(`champ-${Object.keys(manquants)[0]}`)?.focus();
      return;
    }
    setCreation(true);
    try {
      const r = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gabaritId, revisionId, plan, valeurs }) });
      const json = await r.json();
      if (r.ok) {
        router.push(`/documents/${json.id}`);
        return;
      }
      setMessage(json.message ?? "Création impossible.");
      if (Array.isArray(json.erreurs)) setErreurs(Object.fromEntries(json.erreurs.map((x: { champ: string; message: string }) => [x.champ, x.message])));
    } catch {
      setMessage("Connexion perdue : réessaie dans un instant.");
    }
    setCreation(false);
  }

  const alertes = apercu.rapport.filter((z) => z.reduit || z.coupe || z.depasse);
  const libelleDe = (nom: string) => champs.find((c) => c.nom === nom)?.libelle ?? nom;
  const photoEnCours = Object.values(photos).some((p) => p.envoi);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form onSubmit={creer} noValidate className="flex flex-col gap-6">
        {message && (
          <p role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
            {message}
          </p>
        )}
        {champs.map((c) => {
          const id = `champ-${c.nom}`;
          const err = erreurs[c.nom];
          const aide = [c.aide && `${id}-aide`, err && `${id}-erreur`].filter(Boolean).join(" ") || undefined;
          const v = valeurs[c.nom] ?? "";
          const etiquette = (
            <>
              {c.libelle}
              {c.obligatoire && <span className="text-encre-douce"> (obligatoire)</span>}
            </>
          );
          return (
            <div key={c.nom} className="flex flex-col gap-2">
              {c.type === "image" ? (
                <>
                  <span id={`${id}-libelle`} className="font-semibold">
                    {etiquette}
                  </span>
                  <div className="flex items-center gap-3 rounded-m border border-trait bg-surface-relevee p-3">
                    {photos[c.nom] ? (
                      // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) de la photo choisie
                      <img src={photos[c.nom]!.url} alt="" className="size-16 shrink-0 rounded-s object-cover" />
                    ) : (
                      <span className="flex size-16 shrink-0 items-center justify-center rounded-s bg-creme text-orange-texte">
                        <ImagePlus size={24} aria-hidden />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-auto flex-col text-sm leading-5">
                      <span className="truncate font-semibold">{photos[c.nom]?.nom ?? "Aucune photo"}</span>
                      <span className={photos[c.nom]?.erreur ? "text-danger" : "text-encre-douce"}>
                        {photos[c.nom]?.envoi ? "Envoi en cours…" : photos[c.nom]?.erreur ?? (photos[c.nom] ? "Photo prête" : "JPEG, PNG ou WebP")}
                      </span>
                    </span>
                    <label className="relative flex min-h-11 shrink-0 cursor-pointer items-center rounded-m border border-vert-esatic px-4 font-semibold text-vert-esatic focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-vert-esatic">
                      {photos[c.nom] ? "Changer" : "Choisir"}
                      <input
                        id={id}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-labelledby={`${id}-libelle`}
                        aria-describedby={aide}
                        aria-invalid={err ? true : undefined}
                        className="sr-only"
                        onChange={(e) => void choisirPhoto(c.nom, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label htmlFor={id} className="font-semibold">
                    {etiquette}
                  </label>
                  {c.multiligne ? (
                    <textarea
                      id={id}
                      value={v}
                      rows={4}
                      maxLength={c.maxCaracteres}
                      required={c.obligatoire}
                      aria-describedby={aide}
                      aria-invalid={err ? true : undefined}
                      onChange={(e) => changer(c.nom, e.target.value)}
                      className={champ + " py-2.5"}
                    />
                  ) : (
                    <input
                      id={id}
                      type={c.type === "date" ? "date" : c.type === "texte" ? "text" : "number"}
                      inputMode={c.type === "nombre" || c.type === "jauge" ? "decimal" : undefined}
                      value={v}
                      min={c.min}
                      max={c.max}
                      maxLength={c.maxCaracteres}
                      required={c.obligatoire}
                      aria-describedby={aide}
                      aria-invalid={err ? true : undefined}
                      onChange={(e) => changer(c.nom, e.target.value)}
                      className={champ}
                    />
                  )}
                </>
              )}
              {(c.aide || c.maxCaracteres) && c.type !== "image" && (
                <span className="flex justify-between gap-3 text-sm leading-5 text-encre-douce">
                  <span id={c.aide ? `${id}-aide` : undefined}>{c.aide}</span>
                  {c.maxCaracteres && (
                    <span aria-hidden className="shrink-0 whitespace-nowrap">
                      {String(v).length} / {c.maxCaracteres}
                    </span>
                  )}
                </span>
              )}
              {c.aide && c.type === "image" && (
                <span id={`${id}-aide`} className="text-sm leading-5 text-encre-douce">
                  {c.aide}
                </span>
              )}
              {err && (
                <span id={`${id}-erreur`} className="text-sm leading-5 font-semibold text-danger">
                  {err}
                </span>
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={creation || photoEnCours}
          className="flex min-h-12 items-center justify-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70"
        >
          {creation ? <Loader2 size={20} aria-hidden className="animate-spin" /> : <Download size={20} aria-hidden />}
          {creation ? "Création du document…" : "Créer le document"}
        </button>
      </form>

      <section aria-label="Aperçu" className="order-first flex flex-col gap-3 lg:sticky lg:top-6 lg:order-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {plans.length > 1 ? (
            <div role="tablist" aria-label="Déclinaison" className="flex flex-wrap gap-1 rounded-m bg-creme p-1">
              {plans.map((p) => (
                <button
                  key={p.plan}
                  type="button"
                  role="tab"
                  aria-selected={p.plan === plan}
                  onClick={() => setPlan(p.plan)}
                  className={"min-h-10 rounded-s px-3 text-sm " + (p.plan === plan ? "bg-surface-relevee font-semibold shadow-carte" : "text-encre-douce")}
                >
                  {formatPlan(p)}
                </button>
              ))}
            </div>
          ) : (
            <span className="etiquette text-encre-douce">{formatPlan(plans[0]!)}</span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-encre-douce" aria-live="polite">
            {apercu.chargement ? (
              <>
                <Loader2 size={16} aria-hidden className="animate-spin" /> Mise à jour…
              </>
            ) : (
              "Mis à jour pendant la saisie"
            )}
          </span>
        </div>
        <div className="overflow-hidden rounded-l border border-trait bg-surface-relevee shadow-carte">
          {apercu.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- image produite par le serveur de rendu (blob:)
            <img src={apercu.url} alt="Aperçu du document avec les valeurs saisies" className={"block h-auto w-full transition-opacity " + (apercu.chargement ? "opacity-70" : "")} />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center text-encre-douce">
              <Loader2 size={28} aria-hidden className="animate-spin" />
              <span className="sr-only">Préparation de l&apos;aperçu</span>
            </div>
          )}
        </div>
        {apercu.erreur ? (
          <p className="m-0 flex gap-2 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
            {apercu.erreur}
          </p>
        ) : alertes.length ? (
          <p className="m-0 flex gap-2 rounded-m bg-fond-attention p-3.5 text-sm leading-5 text-attention">
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
            <span>
              {alertes.map((z) => (
                <span key={z.champ} className="block">
                  <strong>{libelleDe(z.champ)}</strong> :{" "}
                  {z.coupe || z.depasse ? "texte trop long, il est coupé. Raccourcis-le." : "texte un peu long, sa taille a été réduite pour tenir."}
                </span>
              ))}
            </span>
          </p>
        ) : (
          <p className="m-0 flex gap-2 rounded-m bg-fond-succes p-3.5 text-sm leading-5 text-succes">
            <CheckCircle2 size={18} aria-hidden className="mt-px shrink-0" />
            <span>
              <strong>Tout tient.</strong> Les champs encore vides montrent l&apos;exemple du designer.
            </span>
          </p>
        )}
      </section>
    </div>
  );
}
