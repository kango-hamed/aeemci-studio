"use client";

import { useState } from "react";
import { ChevronDown, FileUp, Search, UserPlus, X } from "lucide-react";
import { simplifier } from "@/fonctionnalites/csv";
import type { OptionDelegation } from "./ChampsPoste";
import { FormulaireMembre } from "./FormulaireMembre";
import { ImportMembres } from "./ImportMembres";
import { supprimerCompte } from "./actions";
import { LigneMembre } from "./LigneMembre";
import type { AncienMembre, MembreDuMandat } from "./requetes";
import { LIBELLES_ROLES } from "./roles";
import { SuppressionDefinitive } from "./SuppressionDefinitive";
import { coordonnee } from "./telephone";

type Panneau = "ajout" | "import" | null;
type Filtre = "tous" | "a_activer";

const BUREAU = "Bureau exécutif";

/** Texte où chercher un membre : nom, e-mail, numéro (avec ou sans espaces), rôle, délégation. */
function cherchable(m: MembreDuMandat): string {
  return simplifier([m.nom, m.email, m.telephone ?? "", m.telephone?.slice(3) ?? "", LIBELLES_ROLES[m.role], m.delegation ?? BUREAU].join(" "));
}

/**
 * Onglet Membres : ajout et import repliés derrière deux boutons, puis la liste du mandat, cherchable et
 * groupée par délégation (bureau exécutif d'abord). Les anciens membres sont repliés en bas.
 */
export function OngletMembres(p: { membres: MembreDuMandat[]; anciens: AncienMembre[]; delegations: OptionDelegation[]; moi: string; administrateur: boolean }) {
  const [panneau, setPanneau] = useState<Panneau>(null);
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const aActiver = p.membres.filter((m) => m.compte !== "actif").length;
  const mots = simplifier(recherche).split("_").filter(Boolean);
  const visibles = p.membres.filter((m) => (filtre === "tous" || m.compte !== "actif") && mots.every((mot) => cherchable(m).includes(mot)));
  // L'ordre de la requête (bureau d'abord, puis par délégation) donne l'ordre des groupes.
  const groupes = new Map<string, MembreDuMandat[]>();
  for (const m of visibles) groupes.set(m.delegation ?? BUREAU, [...(groupes.get(m.delegation ?? BUREAU) ?? []), m]);

  const basculer = (q: Exclude<Panneau, null>) => setPanneau((v) => (v === q ? null : q));
  const boutonPanneau = (q: Exclude<Panneau, null>, actif: boolean) =>
    `flex min-h-11 items-center gap-2 rounded-m px-4 font-semibold ${actif ? "bg-vert-esatic text-sur-vert" : "border border-vert-esatic text-vert-esatic"}`;

  return (
    <section className="flex flex-col gap-5" aria-label="Membres du mandat">
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-expanded={panneau === "ajout"} aria-controls="panneau-ajout" onClick={() => basculer("ajout")} className={boutonPanneau("ajout", panneau === "ajout")}>
          <UserPlus size={18} aria-hidden />
          Ajouter un membre
        </button>
        <button type="button" aria-expanded={panneau === "import"} aria-controls="panneau-import" onClick={() => basculer("import")} className={boutonPanneau("import", panneau === "import")}>
          <FileUp size={18} aria-hidden />
          Importer un fichier
        </button>
      </div>
      {/* Masqués plutôt que retirés : les liens d'activation affichés après un ajout ou un import restent là si on referme. */}
      <div id="panneau-ajout" hidden={panneau !== "ajout"}>
        <FormulaireMembre delegations={p.delegations} />
      </div>
      <div id="panneau-import" hidden={panneau !== "import"}>
        <ImportMembres />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <label htmlFor="recherche-membre" className="sr-only">
              Chercher un membre
            </label>
            <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-encre-douce" />
            <input
              id="recherche-membre"
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, e-mail, numéro, délégation…"
              autoComplete="off"
              className="min-h-11 w-full rounded-m border border-trait-champ bg-surface-relevee pr-10 pl-10 text-base text-encre"
            />
            {recherche && (
              <button type="button" onClick={() => setRecherche("")} aria-label="Effacer la recherche" className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-s text-encre-douce">
                <X size={18} aria-hidden />
              </button>
            )}
          </div>
          <div role="group" aria-label="Filtrer les membres" className="flex rounded-m border border-trait-champ p-0.5">
            {(
              [
                ["tous", `Tous (${p.membres.length})`],
                ["a_activer", `À activer (${aActiver})`],
              ] as const
            ).map(([cle, libelle]) => (
              <button
                key={cle}
                type="button"
                aria-pressed={filtre === cle}
                onClick={() => setFiltre(cle)}
                className={`min-h-10 rounded-s px-3 text-sm font-semibold whitespace-nowrap ${filtre === cle ? "bg-creme text-encre" : "text-encre-douce"}`}
              >
                {libelle}
              </button>
            ))}
          </div>
        </div>
        <p className="sr-only" role="status">
          {visibles.length} membre{visibles.length > 1 ? "s" : ""} affiché{visibles.length > 1 ? "s" : ""}
        </p>

        {groupes.size ? (
          [...groupes].map(([nom, membres]) => (
            <section key={nom} aria-labelledby={`groupe-${simplifier(nom)}`} className="rounded-l border border-trait bg-surface-relevee shadow-carte">
              <h2 id={`groupe-${simplifier(nom)}`} className="m-0 flex items-baseline justify-between gap-3 border-b border-trait px-4 py-3 text-base font-semibold">
                {nom}
                <span className="text-sm font-normal text-encre-douce">
                  {membres.length} membre{membres.length > 1 ? "s" : ""}
                </span>
              </h2>
              <ul className="m-0 list-none px-4 py-0">
                {membres.map((m) => (
                  <LigneMembre key={m.affectationId} m={m} delegations={p.delegations} estMoi={m.userId === p.moi} administrateur={p.administrateur} />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <p className="m-0 rounded-l border border-trait bg-surface-relevee p-5 text-encre-douce">
            {p.membres.length ? "Aucun membre ne correspond." : "Aucun membre dans le mandat pour l'instant : ajoute-les un par un ou importe un fichier."}
          </p>
        )}
      </div>

      {p.anciens.length > 0 && (
        <details className="group rounded-l border border-trait bg-surface-relevee">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
            Sans rôle dans ce mandat ({p.anciens.length})
            <ChevronDown size={18} aria-hidden className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col gap-3 border-t border-trait p-4">
            <p className="m-0 text-sm text-encre-douce">
              Pour leur redonner un rôle, ajoute-les avec la même adresse e-mail : leur compte et leurs documents sont conservés.
            </p>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2 p-0">
              {p.anciens.map((a) => (
                <li key={a.userId} className="flex flex-col rounded-m border border-trait p-3">
                  <span className="font-semibold">{a.nom}</span>
                  <span className="text-sm break-all text-encre-douce">{coordonnee(a.email, a.telephone)}</span>
                  {p.administrateur && (
                    <div className="mt-2">
                      <SuppressionDefinitive
                        id={a.userId}
                        quoi="ce compte"
                        consequences="Pour un doublon ou un compte créé par erreur : le compte, ses sessions et ses liens d'activation disparaissent."
                        refus={a.refusSuppression}
                        action={supprimerCompte}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </section>
  );
}
