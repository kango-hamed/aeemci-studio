import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigerUtilisateur } from "@/fonctionnalites/authentification/session";
import { gabaritACompleter } from "@/fonctionnalites/gabarits/requetes";
import { peutCreerDocuments } from "@/fonctionnalites/organisation/droits";
import { MESSAGE_SANS_ROLE } from "@/serveur/reponses";
import { FormulaireCreation, type ChampFormulaire } from "@/fonctionnalites/generation/FormulaireCreation";

export const metadata: Metadata = { title: "Créer un document" };

export default async function PageCreer({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigerUtilisateur();
  const g = await gabaritACompleter((await params).id);
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
      {peutCreerDocuments(u) ? (
        <FormulaireCreation
          gabaritId={g.id}
          revisionId={g.revision.id}
          champs={champs}
          plans={contenu.plans.map((p) => ({ plan: p.plan, largeur: p.largeur_px, hauteur: p.hauteur_px }))}
          aUneDelegation={Boolean(u.affectation?.delegationId)}
        />
      ) : (
        <p className="m-0 rounded-l bg-creme p-6">{MESSAGE_SANS_ROLE}</p>
      )}
    </>
  );
}
