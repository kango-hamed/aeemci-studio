"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, ImagePlus, Loader2, Square } from "lucide-react";
import { lienCsv } from "@/fonctionnalites/csv";
import { ChampsPartage } from "@/fonctionnalites/documents/ChampsPartage";
import { reduirePhoto, type ChampFormulaire } from "./FormulaireCreation";
import { cleFichier, ErreurLot, familleDe, LIBELLES_FAMILLES, lireLot, MAX_LIGNES_LOT, modeleLot, type ChampLot, type Famille, type Lot } from "./lot";

interface RapportZone {
  champ: string;
  reduit?: boolean;
  coupe?: boolean;
  depasse?: boolean;
}

interface Resultat {
  ligne: number;
  id?: string;
  message?: string;
}

const COULEURS: Record<Famille, string> = {
  texte: "bg-fond-succes text-succes",
  calculee: "bg-creme text-orange-texte",
  image: "bg-vert-profond text-sur-vert-profond",
  autre: "bg-surface text-encre-douce border border-trait",
};

function PastilleFamille({ famille }: { famille: Famille }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${COULEURS[famille]}`}>{LIBELLES_FAMILLES[famille]}</span>;
}

/** Ce qu'on écrit dans la colonne, selon le type du champ. */
function consigne(c: ChampFormulaire): string {
  if (c.type === "date") return "Date : 15/11/2026, 2026-11-15 ou 15 novembre 2026. Mise en forme par le gabarit.";
  if (c.type === "nombre") return "Nombre : 166 000 ou 1500,50. Milliers et texte autour ajoutés par le gabarit.";
  if (c.type === "jauge") return `Nombre de ${c.min ?? 0} à ${c.max ?? 100} : la jauge se remplit d'autant.`;
  if (c.type === "image") return "Nom du fichier photo (photo-1.jpg), choisi avec le fichier CSV.";
  return `Texte tel quel${c.maxCaracteres ? `, ${c.maxCaracteres} caractères au plus` : ""}. Retour à la ligne : Alt+Entrée dans Excel.`;
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/**
 * Création par lot : un fichier CSV (une ligne par document) et les photos qu'il nomme, contrôle de
 * chaque ligne, aperçu ligne par ligne, puis création l'une après l'autre et archive ZIP du lot.
 */
export function CreationParLot({
  gabaritId,
  revisionId,
  nomGabarit,
  champs,
  exemples,
  aUneDelegation,
}: {
  gabaritId: string;
  revisionId: string;
  nomGabarit: string;
  champs: ChampFormulaire[];
  exemples: Record<string, string>;
  aUneDelegation: boolean;
}) {
  const champsLot: ChampLot[] = champs.map((c) => ({ nom: c.nom, type: c.type, libelle: c.libelle, obligatoire: c.obligatoire }));
  const champsImage = champs.filter((c) => c.type === "image");
  const [lot, setLot] = useState<Lot | null>(null);
  const [erreurLot, setErreurLot] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Map<string, File>>(new Map());
  const [controle, setControle] = useState<{ erreurs: string[][]; enCours: boolean; message?: string }>({ erreurs: [], enCours: false });
  const [courante, setCourante] = useState(0);
  const [apercu, setApercu] = useState<{ url: string | null; chargement: boolean; erreur?: string; rapport: RapportZone[] }>({ url: null, chargement: false, rapport: [] });
  const [creation, setCreation] = useState<{ fait: number; total: number; resultats: Resultat[]; enCours: boolean } | null>(null);
  const arret = useRef(false);
  const envois = useRef(new Map<File, Promise<string>>());
  const sequence = useRef(0);

  const libelleDe = (nom: string) => champs.find((c) => c.nom === nom)?.libelle ?? nom;

  /** Photos nommées dans une ligne mais pas choisies. */
  const photosManquantes = (i: number) =>
    lot ? Object.entries(lot.lignes[i]!.images).filter(([, nom]) => !photos.has(cleFichier(nom))).map(([champ, nom]) => `${libelleDe(champ)} : photo « ${nom} » non choisie.`) : [];
  const erreursDe = (i: number) => [...photosManquantes(i), ...(controle.erreurs[i] ?? [])];
  const enErreur = lot ? lot.lignes.filter((_, i) => erreursDe(i).length).length : 0;
  const nomsCites = new Set(lot?.lignes.flatMap((l) => Object.values(l.images).map(cleFichier)) ?? []);
  const photosInutiles = [...photos.entries()].filter(([cle]) => !nomsCites.has(cle)).map(([, f]) => f.name);

  async function lireFichier(f: File | undefined) {
    setErreurLot(null);
    setLot(null);
    setCreation(null);
    setControle({ erreurs: [], enCours: false });
    if (!f) return;
    try {
      const l = lireLot(new Uint8Array(await f.arrayBuffer()), champsLot);
      setLot(l);
      setCourante(0);
      await controler(l);
    } catch (e) {
      setErreurLot(e instanceof ErreurLot ? e.message : "Fichier illisible : enregistre-le au format CSV depuis Excel.");
    }
  }

  // Contrôle par le serveur : mêmes règles que le formulaire (une photo nommée compte comme remplie, sa présence est vérifiée ici).
  async function controler(l: Lot) {
    setControle({ erreurs: [], enCours: true });
    try {
      const r = await fetch("/api/documents/lot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gabaritId, lignes: l.lignes.map((x) => ({ valeurs: x.valeurs, images: Object.keys(x.images) })) }),
      });
      const json = await r.json();
      if (!r.ok) return setControle({ erreurs: [], enCours: false, message: json.message ?? "Contrôle impossible." });
      setControle({
        erreurs: (json.erreurs as { message: string }[][]).map((e) => e.map((x) => x.message)),
        enCours: false,
        message: json.revisionId !== revisionId ? "Le gabarit vient d'être mis à jour : recharge la page avant de créer le lot." : undefined,
      });
    } catch {
      setControle({ erreurs: [], enCours: false, message: "Connexion perdue : le fichier n'a pas pu être contrôlé." });
    }
  }

  function choisirPhotos(liste: FileList | null) {
    const m = new Map(photos);
    for (const f of liste ?? []) m.set(cleFichier(f.name), f);
    setPhotos(m);
  }

  /** Envoie une photo une seule fois, même si plusieurs lignes la citent. */
  function televerser(f: File): Promise<string> {
    let p = envois.current.get(f);
    if (!p) {
      p = (async () => {
        const corps = new FormData();
        corps.append("photo", await reduirePhoto(f), f.name.replace(/\.[^.]+$/, "") + ".jpg");
        const r = await fetch("/api/televersements", { method: "POST", body: corps });
        const json = await r.json();
        if (!r.ok) throw new Error(`${f.name} : ${json.message ?? "envoi impossible."}`);
        return `televersement:${json.id}`;
      })();
      p.catch(() => envois.current.delete(f));
      envois.current.set(f, p);
    }
    return p;
  }

  async function valeursDe(i: number): Promise<Record<string, string>> {
    const l = lot!.lignes[i]!;
    const v: Record<string, string> = { ...l.valeurs };
    for (const [champ, nom] of Object.entries(l.images)) {
      const f = photos.get(cleFichier(nom));
      if (f) v[champ] = await televerser(f);
    }
    return v;
  }

  // Aperçu de la ligne affichée, avec ses vraies valeurs (sans l'exemple du designer pour un champ vide).
  useEffect(() => {
    if (!lot || controle.enCours) return;
    const n = ++sequence.current;
    setApercu((a) => ({ ...a, chargement: true, erreur: undefined }));
    void (async () => {
      try {
        const valeurs = await valeursDe(courante);
        const r = await fetch("/api/apercus", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gabaritId, valeurs, exemples: false }) });
        if (n !== sequence.current) return;
        if (!r.ok) {
          const corps = await r.json().catch(() => ({}));
          return setApercu((a) => ({ ...a, chargement: false, erreur: corps.message ?? "Aperçu impossible pour cette ligne." }));
        }
        const rapport = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.headers.get("x-rapport") ?? "W10="), (c) => c.charCodeAt(0)))) as RapportZone[];
        const url = URL.createObjectURL(await r.blob());
        setApercu((a) => {
          if (a.url) URL.revokeObjectURL(a.url);
          return { url, chargement: false, rapport };
        });
      } catch (e) {
        if (n === sequence.current) setApercu((a) => ({ ...a, chargement: false, erreur: e instanceof Error ? e.message : "Aperçu impossible." }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- relancé quand la ligne, le fichier ou les photos changent
  }, [lot, courante, photos, controle.enCours]);

  async function creer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!lot) return;
    const partage = new FormData(e.currentTarget);
    const total = lot.lignes.length;
    const resultats: Resultat[] = [];
    arret.current = false;
    setCreation({ fait: 0, total, resultats, enCours: true });
    for (const [i, l] of lot.lignes.entries()) {
      if (arret.current) break;
      try {
        const r = await fetch("/api/documents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            gabaritId,
            revisionId,
            valeurs: await valeursDe(i),
            titre: l.titre || undefined,
            visibilite: partage.get("visibilite") || undefined,
            statut: partage.get("brouillon") ? "brouillon" : "publie",
            silencieux: i < total - 1,
          }),
        });
        const json = await r.json();
        resultats.push(r.ok ? { ligne: l.ligne, id: json.id } : { ligne: l.ligne, message: json.message ?? "Création refusée." });
      } catch (err) {
        resultats.push({ ligne: l.ligne, message: err instanceof Error ? err.message : "Connexion perdue." });
      }
      setCreation({ fait: i + 1, total, resultats: [...resultats], enCours: true });
    }
    setCreation({ fait: resultats.length, total, resultats: [...resultats], enCours: false });
  }

  const ligne = lot?.lignes[courante];
  const alertes = apercu.rapport.filter((z) => z.reduit || z.coupe || z.depasse);
  const crees = creation?.resultats.filter((r) => r.id) ?? [];
  const pret = lot && !controle.enCours && !controle.message && enErreur === 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte">
        <div className="flex flex-col gap-1">
          <h2 className="titre-3 m-0">1. Le fichier des données</h2>
          <p className="m-0 text-sm leading-5 text-encre-douce">
            Une ligne par document, {MAX_LIGNES_LOT} au plus, une colonne par champ du gabarit (Excel : Enregistrer sous › CSV). Les intitulés reprennent les libellés ci-dessous.
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col divide-y divide-trait rounded-m border border-trait p-0">
          {champs.map((c) => (
            <li key={c.nom} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <PastilleFamille famille={familleDe(c.type)} />
              <span className="font-semibold">
                {c.libelle}
                {!c.obligatoire && <span className="font-normal text-encre-douce"> (facultatif)</span>}
              </span>
              <span className="basis-full leading-5 text-encre-douce sm:basis-auto">{consigne(c)}</span>
            </li>
          ))}
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
            <PastilleFamille famille="autre" />
            <span className="font-semibold">
              Titre du document <span className="font-normal text-encre-douce">(facultatif)</span>
            </span>
            <span className="basis-full leading-5 text-encre-douce sm:basis-auto">Sinon : « {nomGabarit} – » suivi du nom. Toute autre colonne est ignorée.</span>
          </li>
        </ul>
        <a href={lienCsv(modeleLot(champsLot, exemples))} download={`${nomGabarit.replace(/[^\p{L}\p{N}]+/gu, "-")}-lot.csv`} className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
          <Download size={16} aria-hidden />
          Télécharger le fichier modèle
        </a>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet size={16} aria-hidden /> Fichier CSV
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void lireFichier(e.target.files?.[0])}
              aria-invalid={erreurLot ? true : undefined}
              aria-describedby={erreurLot ? "erreur-lot" : undefined}
              className="text-base file:mr-3 file:min-h-11 file:rounded-m file:border file:border-vert-esatic file:bg-transparent file:px-4 file:font-semibold file:text-vert-esatic"
            />
          </label>
          {champsImage.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ImagePlus size={16} aria-hidden /> Photos nommées dans le fichier {photos.size > 0 && <span className="font-normal text-encre-douce">({pluriel(photos.size, "choisie")})</span>}
              </span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => choisirPhotos(e.target.files)}
                className="text-base file:mr-3 file:min-h-11 file:rounded-m file:border file:border-vert-esatic file:bg-transparent file:px-4 file:font-semibold file:text-vert-esatic"
              />
            </label>
          )}
        </div>
        {erreurLot && (
          <p id="erreur-lot" role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
            {erreurLot}
          </p>
        )}
        {lot && (
          <p className="m-0 text-sm leading-5 text-encre-douce">
            Colonnes lues :{" "}
            {lot.colonnes.map((c, i) => (
              <span key={i} className={c.cible ? "" : "line-through"}>
                {i > 0 && ", "}
                {c.entete || "(sans intitulé)"}
              </span>
            ))}
            {lot.colonnes.some((c) => !c.cible) && " (barrées : ignorées)"}.
            {photosInutiles.length > 0 && ` Photos non citées dans le fichier : ${photosInutiles.join(", ")}.`}
          </p>
        )}
      </section>

      {lot && (
        <section className="flex flex-col gap-4">
          <h2 className="titre-3 m-0">2. Contrôle et aperçu</h2>
          {controle.enCours ? (
            <p className="m-0 flex items-center gap-2 text-sm text-encre-douce">
              <Loader2 size={16} aria-hidden className="animate-spin" /> Contrôle des lignes…
            </p>
          ) : controle.message ? (
            <p role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
              <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
              {controle.message}
            </p>
          ) : enErreur ? (
            <p role="status" className="m-0 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
              <strong>{pluriel(enErreur, "ligne")} à corriger</strong> dans le fichier ou dans les photos choisies. Rien n&apos;est créé tant qu&apos;il reste une erreur.
            </p>
          ) : (
            <p role="status" className="m-0 rounded-m bg-fond-succes p-3.5 text-sm leading-5">
              <strong>{pluriel(lot.lignes.length, "ligne")} correcte{lot.lignes.length > 1 ? "s" : ""}.</strong> Parcours les aperçus, puis crée le lot.
            </p>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <ol className="m-0 flex max-h-[560px] list-none flex-col overflow-y-auto rounded-m border border-trait bg-surface-relevee p-0">
              {lot.lignes.map((l, i) => {
                const erreurs = erreursDe(i);
                const resume = l.titre || Object.values(l.valeurs).find((v) => v.trim())?.split("\n")[0] || "(ligne sans texte)";
                return (
                  <li key={l.ligne} className="border-b border-trait last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setCourante(i)}
                      aria-current={i === courante ? "true" : undefined}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm ${i === courante ? "bg-creme" : ""}`}
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="text-encre-douce">Ligne {l.ligne}</span>
                        <span className="truncate font-semibold">{resume}</span>
                        {!controle.enCours &&
                          (erreurs.length ? <AlertTriangle size={15} aria-label="À corriger" className="ml-auto shrink-0 text-danger" /> : <CheckCircle2 size={15} aria-label="Correcte" className="ml-auto shrink-0 text-succes" />)}
                      </span>
                      {erreurs.map((e) => (
                        <span key={e} className="text-danger">
                          {e}
                        </span>
                      ))}
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-col gap-3 lg:sticky lg:top-6">
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setCourante((c) => Math.max(0, c - 1))} disabled={courante === 0} className="flex min-h-11 items-center gap-1 rounded-m px-3 font-semibold text-vert-esatic disabled:opacity-40">
                  <ChevronLeft size={18} aria-hidden /> Précédente
                </button>
                <span className="text-sm text-encre-douce" aria-live="polite">
                  Ligne {ligne?.ligne} · {courante + 1} sur {lot.lignes.length}
                  {apercu.chargement && <Loader2 size={14} aria-hidden className="ml-2 inline animate-spin" />}
                </span>
                <button
                  type="button"
                  onClick={() => setCourante((c) => Math.min(lot.lignes.length - 1, c + 1))}
                  disabled={courante === lot.lignes.length - 1}
                  className="flex min-h-11 items-center gap-1 rounded-m px-3 font-semibold text-vert-esatic disabled:opacity-40"
                >
                  Suivante <ChevronRight size={18} aria-hidden />
                </button>
              </div>
              <div className="overflow-hidden rounded-l border border-trait bg-surface-relevee shadow-carte">
                {apercu.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- image produite par le serveur de rendu (blob:)
                  <img src={apercu.url} alt={`Aperçu de la ligne ${ligne?.ligne}`} className={"block h-auto w-full transition-opacity " + (apercu.chargement ? "opacity-60" : "")} />
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
              ) : (
                alertes.length > 0 && (
                  <p className="m-0 flex gap-2 rounded-m bg-fond-attention p-3.5 text-sm leading-5 text-attention">
                    <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
                    <span>
                      {alertes.map((z) => (
                        <span key={z.champ} className="block">
                          <strong>{libelleDe(z.champ)}</strong> : {z.coupe || z.depasse ? "texte trop long, il est coupé." : "texte un peu long, sa taille a été réduite."}
                        </span>
                      ))}
                    </span>
                  </p>
                )
              )}
            </div>
          </div>
        </section>
      )}

      {lot && (
        <form onSubmit={creer} className="flex flex-col gap-4">
          <h2 className="titre-3 m-0">3. Création</h2>
          <ChampsPartage prefixe="lot" aUneDelegation={aUneDelegation} />
          {creation ? (
            <div role="status" className="flex flex-col gap-3 rounded-m border border-trait bg-surface-relevee p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">
                  {creation.enCours ? `Création ${Math.min(creation.fait + 1, creation.total)} sur ${creation.total}…` : `${pluriel(crees.length, "document")} créé${crees.length > 1 ? "s" : ""} sur ${creation.total}.`}
                </span>
                {creation.enCours && (
                  <button type="button" onClick={() => (arret.current = true)} className="flex min-h-11 items-center gap-2 rounded-m border border-trait-champ px-3 font-semibold">
                    <Square size={14} aria-hidden /> Arrêter après celui-ci
                  </button>
                )}
              </div>
              <progress max={creation.total} value={creation.fait} className="h-2 w-full accent-vert-esatic" />
              {creation.resultats.some((r) => r.message) && (
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-danger">
                  {creation.resultats
                    .filter((r) => r.message)
                    .map((r) => (
                      <li key={r.ligne}>
                        Ligne {r.ligne} : {r.message}
                      </li>
                    ))}
                </ul>
              )}
              {!creation.enCours && crees.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <a href={`/api/documents/archive?ids=${crees.map((r) => r.id).join(",")}`} className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert no-underline">
                    <Download size={18} aria-hidden /> Télécharger tout (ZIP)
                  </a>
                  <Link href="/documents" className="flex min-h-11 items-center rounded-m border border-vert-esatic px-5 font-semibold text-vert-esatic no-underline">
                    Voir dans Documents
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <button type="submit" disabled={!pret} className="flex min-h-12 items-center justify-center gap-2 self-start rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-50">
              <Download size={20} aria-hidden />
              Créer {pluriel(lot.lignes.length, "document")}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
