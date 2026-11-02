import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";
import { peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";
import { valeursEssai } from "@aeemci-studio/moteur";
import { FormulaireCreation, type ChampFormulaire } from "@/fonctionnalites/generation/FormulaireCreation";
import { CreationParLot } from "@/fonctionnalites/generation/CreationParLot";

export const metadata: Metadata = { title: "Créer un document" };

export default async function PageCreer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const u = await exigerUtilisateur();
  const g = await gabaritACompleter((await params).id, u);
  const parLot = (await searchParams).mode === "lot";
  if (!g) notFound();
  const contenu = g.revision.contenu;
  const zones = contenu.plans.flatMap((p) => p.zones);
  const champs: ChampFormulaire[] = contenu.champs.map((c) => ({
    nom: c.nom,
    type: c.type,
    libelle: c.libelle?.trim() || c.nom,
    aide: c.aide,
    obligatoire: c.obligatoire !== false,
    maxCaracteres: c.max_caracteres,
    min: c.min,
    max: c.max,
    multiligne: c.type === "texte" && zones.some((z) => z.champ === c.nom && z.forme === "box"),
  }));
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-encre-douce">
        <Link href="/gabarits">Choisir un gabarit</Link>
        <span aria-hidden>›</span>
        <span aria-current="page">{g.nom}</span>
      </nav>
      <div className="flex flex-col gap-2">
        <span className="etiquette text-encre-douce">Étape 2 sur 2</span>
        <h1 className="titre-1 m-0">{g.nom}</h1>
        {g.description && <p className="m-0 max-w-[680px] text-encre-douce">{g.description}</p>}
      </div>
      {peutCreerDocuments(u) && (
        <div role="tablist" aria-label="Mode de création" className="flex flex-wrap gap-1 self-start rounded-m bg-creme p-1">
          {[
            { lot: false, libelle: "Un document" },
            { lot: true, libelle: "Plusieurs à la fois (fichier CSV)" },
          ].map((m) => (
            <Link
              key={m.libelle}
              href={m.lot ? `/creer/${g.id}?mode=lot` : `/creer/${g.id}`}
              role="tab"
              aria-selected={m.lot === parLot}
              className={"flex min-h-10 items-center rounded-s px-3 text-sm no-underline " + (m.lot === parLot ? "bg-surface-relevee font-semibold text-encre shadow-carte" : "text-encre-douce")}
            >
              {m.libelle}
            </Link>
          ))}
        </div>
      )}
      {!peutCreerDocuments(u) ? (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      ) : parLot ? (
        <CreationParLot
          gabaritId={g.id}
          revisionId={g.revision.id}
          nomGabarit={g.nom}
          champs={champs}
          exemples={Object.fromEntries(Object.entries(valeursEssai(contenu, "exemple")).filter(([nom]) => contenu.champs.some((c) => c.nom === nom && c.type !== "image")).map(([nom, v]) => [nom, String(v ?? "")]))}
          aUneDelegation={Boolean(u.affectation?.delegationId)}
        />
      ) : (
        <FormulaireCreation
          gabaritId={g.id}
          revisionId={g.revision.id}
          champs={champs}
          plans={contenu.plans.map((p) => ({ plan: p.plan, largeur: p.largeur_px, hauteur: p.hauteur_px }))}
          aUneDelegation={Boolean(u.affectation?.delegationId)}
        />
      )}
    </>
  );
}
