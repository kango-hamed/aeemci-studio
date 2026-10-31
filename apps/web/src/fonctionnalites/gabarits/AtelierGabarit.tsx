"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Loader2 } from "lucide-react";
import type { Champ, Controles, Gabarit, RapportZone, Zone } from "@aeemci-studio/moteur";
import { enregistrerReglages, publierGabarit, type EtatGabarit } from "./actions";

const champ = "min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";
const TYPES: Record<string, string> = { texte: "Texte", date: "Date", nombre: "Nombre", image: "Image", jauge: "Jauge" };
const MODES = [
  ["exemple", "Texte d'exemple"],
  ["long", "Texte le plus long"],
  ["perso", "Mes valeurs"],
] as const;
type Mode = (typeof MODES)[number][0];

/**
 * Réglages du brouillon d'un gabarit, avec l'aperçu rendu par le moteur au fil de la saisie.
 * Ne change que ce que Photoshop ne sait pas : libellés, aides, obligation, longueur, texte trop long.
 */
export function AtelierGabarit({ gabaritId, initial, controlesInitiaux }: { gabaritId: string; initial: Gabarit; controlesInitiaux: Controles }) {
  const router = useRouter();
  const [g, setG] = useState<Gabarit>(initial);
  const [controles, setControles] = useState(controlesInitiaux);
  const [modifie, setModifie] = useState(false);
  const [mode, setMode] = useState<Mode>("exemple");
  const [plan, setPlan] = useState(initial.plans[0]?.plan ?? "");
  const [perso, setPerso] = useState<Record<string, string>>({});
  const [apercu, setApercu] = useState<{ url?: string; rapport?: RapportZone[]; erreur?: string; attente?: boolean }>({ attente: true });
  const [etat, setEtat] = useState<EtatGabarit>({});
  const [enCours, demarrer] = useTransition();
  const numero = useRef(0);

  function changer(f: (x: Gabarit) => void) {
    setG((avant) => {
      const x = structuredClone(avant);
      f(x);
      return x;
    });
    setModifie(true);
    setEtat({});
  }
  const changerChamp = (nom: string, f: (c: Champ) => void) => changer((x) => f(x.champs.find((c) => c.nom === nom)!));
  const changerZone = (p: number, z: number, f: (z: Zone) => void) => changer((x) => f(x.plans[p]!.zones[z]!));

  // Aperçu par le moteur, 400 ms après la dernière modification ; seule la réponse la plus récente compte.
  useEffect(() => {
    const n = ++numero.current;
    const minuteur = setTimeout(async () => {
      setApercu((a) => ({ ...a, attente: true }));
      try {
        const r = await fetch(`/api/gabarits/${gabaritId}/apercu`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contenu: g, mode, plan, valeurs: mode === "perso" ? perso : undefined }),
        });
        if (n !== numero.current) return;
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          return setApercu({ erreur: [j.message ?? "Aperçu impossible.", ...(j.erreurs ?? []).map((e: { message?: string }) => e.message ?? String(e))].join(" ") });
        }
        const brut = r.headers.get("x-rapport");
        const rapport = brut ? (JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(brut), (c) => c.charCodeAt(0)))) as RapportZone[]) : [];
        const url = URL.createObjectURL(await r.blob());
        setApercu((a) => {
          if (a.url) URL.revokeObjectURL(a.url);
          return { url, rapport };
        });
      } catch {
        if (n === numero.current) setApercu({ erreur: "Connexion perdue." });
      }
    }, 400);
    return () => clearTimeout(minuteur);
  }, [g, mode, plan, perso, gabaritId]);

  function enregistrer() {
    demarrer(async () => {
      const r = await enregistrerReglages(gabaritId, g);
      if (r.controles) setControles(r.controles);
      if (!r.erreur) setModifie(false);
      setEtat(r);
    });
  }

  function publier() {
    demarrer(async () => {
      const r = await publierGabarit(gabaritId, g);
      setEtat(r);
      if (r.ok) {
        setModifie(false);
        router.refresh();
      }
    });
  }

  const deplacer = (i: number, d: number) =>
    changer((x) => {
      const j = i + d;
      if (j < 0 || j >= x.champs.length) return;
      [x.champs[i], x.champs[j]] = [x.champs[j]!, x.champs[i]!];
    });

  const problemes = (apercu.rapport ?? []).filter((z) => z.depasse || z.coupe || z.reduit);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
      <div className="flex flex-col gap-4">
        <Alertes controles={controles} />
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {g.champs.map((c, i) => (
            <li key={c.nom} className="flex flex-col gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
              <div className="flex items-center gap-2">
                <span className="rounded-s bg-creme px-2 py-0.5 text-xs font-semibold">{TYPES[c.type] ?? c.type}</span>
                <code className="text-sm text-encre-douce">{c.nom}</code>
                <span className="flex-1" />
                <button type="button" onClick={() => deplacer(i, -1)} disabled={i === 0} className="flex size-11 items-center justify-center rounded-m disabled:opacity-40" aria-label={`Monter « ${c.libelle || c.nom} »`}>
                  <ArrowUp size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => deplacer(i, 1)}
                  disabled={i === g.champs.length - 1}
                  className="flex size-11 items-center justify-center rounded-m disabled:opacity-40"
                  aria-label={`Descendre « ${c.libelle || c.nom} »`}
                >
                  <ArrowDown size={18} aria-hidden />
                </button>
              </div>
              <Saisie id={`libelle-${c.nom}`} libelle="Libellé (la question posée dans le formulaire)">
                <input id={`libelle-${c.nom}`} value={c.libelle ?? ""} maxLength={120} onChange={(e) => changerChamp(c.nom, (x) => (x.libelle = e.target.value))} className={champ} />
              </Saisie>
              <Saisie id={`aide-${c.nom}`} libelle="Aide sous le champ">
                <input
                  id={`aide-${c.nom}`}
                  value={c.aide ?? ""}
                  maxLength={300}
                  placeholder="Ex. : tel qu'il doit apparaître sur l'affiche"
                  onChange={(e) => changerChamp(c.nom, (x) => (x.aide = e.target.value || undefined))}
                  className={champ}
                />
              </Saisie>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex min-h-11 items-center gap-2">
                  <input type="checkbox" checked={c.obligatoire !== false} onChange={(e) => changerChamp(c.nom, (x) => (x.obligatoire = e.target.checked))} className="size-5 accent-vert-esatic" />
                  Obligatoire
                </label>
                {(c.type === "texte" || c.type === "nombre") && (
                  <Saisie id={`max-${c.nom}`} libelle="Caractères au plus">
                    <input
                      id={`max-${c.nom}`}
                      type="number"
                      min={1}
                      value={c.max_caracteres ?? ""}
                      onChange={(e) => changerChamp(c.nom, (x) => (x.max_caracteres = e.target.value ? Math.max(1, parseInt(e.target.value, 10)) : undefined))}
                      className={champ + " w-32"}
                    />
                  </Saisie>
                )}
                {c.type === "jauge" && (
                  <>
                    <Saisie id={`min-${c.nom}`} libelle="Minimum">
                      <input id={`min-${c.nom}`} type="number" value={c.min ?? 0} onChange={(e) => changerChamp(c.nom, (x) => (x.min = Number(e.target.value)))} className={champ + " w-32"} />
                    </Saisie>
                    <Saisie id={`maxj-${c.nom}`} libelle="Maximum (objectif)">
                      <input id={`maxj-${c.nom}`} type="number" value={c.max ?? 100} onChange={(e) => changerChamp(c.nom, (x) => (x.max = Number(e.target.value)))} className={champ + " w-32"} />
                    </Saisie>
                  </>
                )}
              </div>
              {g.plans.flatMap((p, pi) =>
                p.zones.map((z, zi) =>
                  z.champ === c.nom && z.texte ? (
                    <ReglageZone key={`${p.plan}-${zi}`} id={`${c.nom}-${pi}-${zi}`} z={z} c={c} plan={g.plans.length > 1 ? p.plan : null} changer={(f) => changerZone(pi, zi, f)} />
                  ) : null,
                ),
              )}
            </li>
          ))}
        </ol>
      </div>

      <section aria-labelledby="titre-apercu" className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte lg:sticky lg:top-4">
        <h2 id="titre-apercu" className="titre-3 m-0">
          Aperçu
        </h2>
        <div role="group" aria-label="Valeurs de l'aperçu" className="flex flex-wrap gap-2">
          {MODES.map(([m, t]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={"min-h-11 rounded-m border px-3 text-sm font-semibold " + (mode === m ? "border-vert-esatic bg-vert-esatic text-sur-vert" : "border-trait-champ")}
            >
              {t}
            </button>
          ))}
        </div>
        {g.plans.length > 1 && (
          <Saisie id="apercu-plan" libelle="Déclinaison">
            <select id="apercu-plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={champ}>
              {g.plans.map((p) => (
                <option key={p.plan} value={p.plan}>
                  {p.plan} · {p.largeur_px} × {p.hauteur_px}
                </option>
              ))}
            </select>
          </Saisie>
        )}
        {mode === "perso" && (
          <div className="flex flex-col gap-3 rounded-m bg-creme p-3">
            {g.champs
              .filter((c) => c.type !== "image")
              .map((c) => (
                <Saisie key={c.nom} id={`perso-${c.nom}`} libelle={c.libelle || c.nom}>
                  <input
                    id={`perso-${c.nom}`}
                    type={c.type === "date" ? "date" : "text"}
                    inputMode={c.type === "nombre" || c.type === "jauge" ? "decimal" : undefined}
                    maxLength={c.max_caracteres}
                    value={perso[c.nom] ?? ""}
                    onChange={(e) => setPerso((v) => ({ ...v, [c.nom]: e.target.value }))}
                    className={champ}
                  />
                </Saisie>
              ))}
            <p className="m-0 text-sm text-encre-douce">Les photos sont remplacées par une photo d&apos;essai.</p>
          </div>
        )}
        <div className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-m bg-creme">
          {/* eslint-disable-next-line @next/next/no-img-element -- image produite à la volée (blob:) */}
          {apercu.url && <img src={apercu.url} alt="Aperçu du document généré" className="block h-auto w-full" />}
          {apercu.attente && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-s bg-surface-relevee px-2 py-1 text-sm">
              <Loader2 size={16} aria-hidden className="animate-spin" />
              Rendu…
            </span>
          )}
        </div>
        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          {apercu.erreur && <p className="m-0 rounded-m bg-fond-danger p-3 text-danger">{apercu.erreur}</p>}
          {problemes.map((z, i) => (
            <p key={`${z.champ}-${i}`} className={"m-0 " + (z.depasse ? "text-danger" : "text-encre-douce")}>
              « {g.champs.find((c) => c.nom === z.champ)?.libelle || z.champ} » : {z.depasse ? "dépasse de sa zone" : z.coupe ? "coupé avec « … »" : `réduit à ${Math.round(z.taille ?? 0)} px`}
            </p>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-trait pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={enregistrer} disabled={enCours || !modifie} className="flex min-h-12 items-center rounded-m border border-vert-esatic px-4 font-semibold disabled:opacity-60">
              {modifie ? "Enregistrer le brouillon" : "Brouillon enregistré"}
            </button>
            <button
              type="button"
              onClick={publier}
              disabled={enCours}
              className="flex min-h-12 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert disabled:opacity-60"
            >
              {enCours && <Loader2 size={18} aria-hidden className="animate-spin" />}
              Publier
            </button>
          </div>
          <p className="m-0 text-sm text-encre-douce">Publier enregistre les réglages et met cette version à la disposition des membres.</p>
          <div aria-live="polite">
            {etat.erreur && (
              <div role="alert" className="flex flex-col gap-1 rounded-m bg-fond-danger p-3 text-danger">
                <p className="m-0 font-semibold">{etat.erreur}</p>
                {etat.details?.length ? (
                  <ul className="m-0 pl-5 text-sm">
                    {etat.details.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            {etat.numero && (
              <p className="m-0 flex gap-2 rounded-m bg-fond-succes p-3 font-semibold text-succes">
                <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0" />
                Révision {etat.numero} publiée.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Saisie({ id, libelle, children }: { id: string; libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {libelle}
      </label>
      {children}
    </div>
  );
}

function ReglageZone({ id, z, c, plan, changer }: { id: string; z: Zone; c: Champ; plan: string | null; changer: (f: (z: Zone) => void) => void }) {
  const taille = z.texte!.taille_px;
  const mode = z.debordement?.mode ?? "reduire";
  const pct = Math.round(((z.debordement?.taille_min_px ?? taille * 0.55) / taille) * 100);
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-m border border-trait p-3">
      <legend className="px-1 text-sm font-semibold">
        Calque « {z.calque || z.champ} »{plan ? ` · ${plan}` : ""}
        {z.conteneur ? ` · dans « ${z.conteneur} »` : ""}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <Saisie id={`deb-${id}`} libelle="Si le texte est trop long">
          <select id={`deb-${id}`} value={mode} onChange={(e) => changer((x) => (x.debordement = { ...x.debordement, mode: e.target.value as "reduire" | "couper" | "refuser" }))} className={champ}>
            <option value="reduire">Réduire la taille</option>
            <option value="couper">Couper avec « … »</option>
            <option value="refuser">Refuser la saisie</option>
          </select>
        </Saisie>
        <Saisie id={`min-${id}`} libelle="Taille minimale (% de l'original)">
          <input
            id={`min-${id}`}
            type="number"
            min={20}
            max={100}
            value={pct}
            onChange={(e) => changer((x) => (x.debordement = { mode, taille_min_px: Math.round(taille * Math.min(100, Math.max(20, Number(e.target.value) || 55))) / 100 }))}
            className={champ}
          />
        </Saisie>
        {z.forme !== "box" && (
          <Saisie id={`larg-${id}`} libelle="Largeur disponible (px du document)">
            <input id={`larg-${id}`} type="number" min={1} value={z.largeur_max ?? ""} onChange={(e) => changer((x) => (x.largeur_max = Number(e.target.value) || undefined))} className={champ} />
          </Saisie>
        )}
        {c.type === "date" ? (
          <Saisie id={`fmt-${id}`} libelle="Format (EEEE d MMMM yyyy : dimanche 15 novembre 2026)">
            <input id={`fmt-${id}`} value={z.format ?? "EEEE d MMMM yyyy"} onChange={(e) => changer((x) => (x.format = e.target.value || undefined))} className={champ} />
          </Saisie>
        ) : (
          <Saisie id={`mod-${id}`} libelle="Texte fixe autour de la valeur, avec {valeur}">
            <input
              id={`mod-${id}`}
              defaultValue={z.modele ?? ""}
              placeholder="Ex. : Collecté : {valeur} f CFA"
              onChange={(e) => changer((x) => (x.modele = e.target.value.includes("{valeur}") ? e.target.value : undefined))}
              className={champ}
            />
          </Saisie>
        )}
      </div>
    </fieldset>
  );
}

function Alertes({ controles }: { controles: Controles }) {
  if (!controles.bloquants.length && !controles.remarques.length)
    return (
      <p className="m-0 flex items-center gap-2 rounded-m bg-fond-succes p-3 font-semibold text-succes">
        <CheckCircle2 size={18} aria-hidden />
        Contrôles passés : le gabarit peut être publié.
      </p>
    );
  return (
    <div className="flex flex-col gap-2">
      {controles.bloquants.length > 0 && (
        <div className="rounded-m bg-fond-danger p-3 text-danger">
          <p className="m-0 flex items-center gap-2 font-semibold">
            <AlertTriangle size={18} aria-hidden />À corriger avant de publier
          </p>
          <ul className="m-0 mt-1 pl-7 text-sm">
            {controles.bloquants.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      {controles.remarques.length > 0 && (
        <div className="rounded-m bg-fond-attention p-3 text-attention">
          <p className="m-0 font-semibold">À relire</p>
          <ul className="m-0 mt-1 pl-5 text-sm">
            {controles.remarques.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
