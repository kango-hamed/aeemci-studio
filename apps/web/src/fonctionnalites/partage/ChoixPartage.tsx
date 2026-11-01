"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, FileText, Loader2, Palette, Upload } from "lucide-react";
import { envoyerFichiers } from "@/fonctionnalites/documents/envoiMultiple";
import { visibilitesPour } from "@/fonctionnalites/documents/partage";
import { fichiersPartages, oublierPartage } from "./fichiers";

export interface ChoixPartageProps {
  activites: { id: string; titre: string; date: string }[];
  gabarits: { id: string; nom: string; revisionId: string; aVignette: boolean }[];
  aUneDelegation: boolean;
}

const champ = "min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";
const carte = "flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte";
const boutonPrincipal = "flex min-h-12 items-center justify-center gap-2 rounded-m bg-vert-esatic px-5 font-semibold text-sur-vert disabled:opacity-70";

const dateCourte = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Où mettre les photos ou le PDF partagés depuis la galerie : une activité, une affiche, les documents. */
export function ChoixPartage({ activites, gabarits, aUneDelegation }: ChoixPartageProps) {
  const router = useRouter();
  const [fichiers, setFichiers] = useState<File[] | null>(null);
  const [apercus, setApercus] = useState<string[]>([]);
  const [activiteId, setActiviteId] = useState(activites[0]?.id ?? "");
  const [visibilite, setVisibilite] = useState(aUneDelegation ? "delegation" : "bureau");
  const [envoi, setEnvoi] = useState<{ fait: number; total: number } | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let urls: string[] = [];
    fichiersPartages()
      .then((f) => {
        setFichiers(f);
        urls = f.filter((x) => x.type.startsWith("image/")).slice(0, 6).map((x) => URL.createObjectURL(x));
        setApercus(urls);
      })
      .catch(() => setFichiers([]));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  if (fichiers === null)
    return (
      <p className="m-0 flex items-center gap-2 text-encre-douce" aria-live="polite">
        <Loader2 size={18} aria-hidden className="animate-spin" /> Lecture des fichiers partagés…
      </p>
    );

  if (!fichiers.length)
    return (
      <div className="flex flex-col gap-3 rounded-l bg-creme p-6">
        <p className="m-0 font-semibold">Aucun fichier en attente.</p>
        <p className="m-0 text-encre-douce">
          Depuis la galerie du téléphone, choisis une photo, touche « Partager » puis « AEEMCI ». L&apos;application doit être installée (Android).
        </p>
      </div>
    );

  const images = fichiers.filter((f) => f.type.startsWith("image/"));
  const nb = fichiers.length;
  const photos = images.length === nb;
  const quoi = photos ? (nb > 1 ? `${nb} photos reçues` : "1 photo reçue") : nb > 1 ? `${nb} fichiers reçus` : "1 fichier reçu";

  async function deposer(champs: Record<string, string>, suite: string) {
    setErreur("");
    setEnvoi({ fait: 0, total: fichiers!.length });
    const bilan = await envoyerFichiers(fichiers!, champs, (fait) => setEnvoi({ fait, total: fichiers!.length }));
    setEnvoi(null);
    if (bilan.echecs.length) {
      setErreur(`${bilan.envoyes} envoyé(s), ${bilan.echecs.length} refusé(s) : ${bilan.echecs.map((e) => `${e.nom} (${e.message})`).join(", ")}`);
      if (!bilan.envoyes) return;
    }
    await oublierPartage();
    router.push(suite);
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="m-0 font-semibold">{quoi}</p>
        {apercus.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {apercus.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) du fichier partagé
              <img key={u} src={u} alt="" className="size-20 shrink-0 rounded-s object-cover" />
            ))}
          </div>
        ) : (
          <p className="m-0 flex items-center gap-2 text-sm text-encre-douce">
            <FileText size={18} aria-hidden /> {fichiers.map((f) => f.name).join(", ")}
          </p>
        )}
      </div>

      {erreur && (
        <p role="alert" className="m-0 flex gap-2 rounded-m bg-fond-danger p-3.5 text-sm leading-5 text-danger">
          <AlertTriangle size={18} aria-hidden className="mt-px shrink-0" />
          {erreur}
        </p>
      )}
      {envoi && (
        <p className="m-0 flex items-center gap-2 font-semibold" aria-live="polite">
          <Loader2 size={18} aria-hidden className="animate-spin" /> Envoi {envoi.fait} / {envoi.total}…
        </p>
      )}

      <section className={carte} aria-labelledby="partage-activite">
        <h2 id="partage-activite" className="m-0 flex items-center gap-2 text-lg font-semibold">
          <CalendarDays size={20} aria-hidden className="text-orange-texte" /> Ajouter à une activité
        </h2>
        {activites.length ? (
          <>
            <label htmlFor="partage-choix-activite" className="sr-only">
              Activité
            </label>
            <select id="partage-choix-activite" value={activiteId} onChange={(e) => setActiviteId(e.target.value)} className={champ}>
              {activites.map((a) => (
                <option key={a.id} value={a.id}>
                  {dateCourte(a.date)} · {a.titre}
                </option>
              ))}
            </select>
            <button type="button" disabled={Boolean(envoi)} onClick={() => void deposer({ activiteId }, `/activites/${activiteId}`)} className={boutonPrincipal}>
              <Upload size={20} aria-hidden /> Ajouter {nb > 1 ? `les ${nb}` : ""} à l&apos;activité
            </button>
          </>
        ) : (
          <p className="m-0 text-sm text-encre-douce">Aucune activité du mandat où tu peux ajouter des photos.</p>
        )}
      </section>

      {images.length > 0 && (
        <section className={carte} aria-labelledby="partage-affiche">
          <h2 id="partage-affiche" className="m-0 flex items-center gap-2 text-lg font-semibold">
            <Palette size={20} aria-hidden className="text-orange-texte" /> Faire une affiche avec {images.length > 1 ? "la première photo" : "cette photo"}
          </h2>
          {gabarits.length ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
              {gabarits.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    disabled={Boolean(envoi)}
                    onClick={() => router.push(`/creer/${g.id}?partage=1`)}
                    className="flex w-full flex-col overflow-hidden rounded-m border border-trait bg-surface text-left"
                  >
                    <span className="aspect-[4/5] w-full bg-creme">
                      {g.aVignette && (
                        // eslint-disable-next-line @next/next/no-img-element -- vignette privée servie par l'API
                        <img src={`/api/gabarits/${g.id}/vignette?r=${g.revisionId}`} alt="" loading="lazy" className="size-full object-cover object-top" />
                      )}
                    </span>
                    <span className="p-2 text-sm font-semibold">{g.nom}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-encre-douce">Aucun gabarit avec photo n&apos;est disponible pour toi.</p>
          )}
        </section>
      )}

      <section className={carte} aria-labelledby="partage-documents">
        <h2 id="partage-documents" className="m-0 flex items-center gap-2 text-lg font-semibold">
          <FileText size={20} aria-hidden className="text-orange-texte" /> Déposer dans les documents
        </h2>
        {nb === 1 ? (
          <button type="button" disabled={Boolean(envoi)} onClick={() => router.push("/documents/deposer?partage=1")} className={boutonPrincipal}>
            <Upload size={20} aria-hidden /> Continuer : titre et partage
          </button>
        ) : (
          <>
            <label htmlFor="partage-visibilite" className="text-sm font-semibold">
              Qui peut les voir
            </label>
            <select id="partage-visibilite" value={visibilite} onChange={(e) => setVisibilite(e.target.value)} className={champ}>
              {visibilitesPour(aUneDelegation).map((v) => (
                <option key={v.valeur} value={v.valeur}>
                  {v.libelle} : {v.detail}
                </option>
              ))}
            </select>
            <button type="button" disabled={Boolean(envoi)} onClick={() => void deposer({ visibilite }, "/documents")} className={boutonPrincipal}>
              <Upload size={20} aria-hidden /> Déposer les {nb} fichiers
            </button>
          </>
        )}
      </section>
    </div>
  );
}
