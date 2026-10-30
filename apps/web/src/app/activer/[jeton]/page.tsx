import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormulaireActivation } from "@/fonctionnalites/authentification/FormulaireActivation";
import { lienValide } from "@/fonctionnalites/organisation/invitations";

export const metadata: Metadata = { title: "Activer mon compte", referrer: "no-referrer" };

/** Lien remis par le bureau : premier mot de passe d'un nouveau membre, ou réinitialisation. */
export default async function PageActivation({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const lien = await lienValide(jeton);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-surface px-6 py-12">
      <span className="flex rounded-m bg-surface-relevee px-3.5 py-2.5 shadow-carte">
        <Image src="/logo-aeemci-esatic.png" alt="Logo AEEMCI ESATIC" width={81} height={48} priority />
      </span>
      {lien ? (
        <FormulaireActivation jeton={jeton} nom={lien.nom} email={lien.email} reinitialisation={lien.reinitialisation} />
      ) : (
        <div className="flex w-full max-w-[380px] flex-col gap-4">
          <h1 className="titre-1 m-0 text-[28px] leading-[34px]">Lien expiré</h1>
          <p className="m-0 text-encre-douce">
            Ce lien a déjà servi ou n&apos;est plus valable (il dure 7 jours). Demande un nouveau lien au secrétaire général
            ou au président de la section.
          </p>
          <Link href="/connexion" className="font-semibold">
            Aller à la connexion
          </Link>
        </div>
      )}
    </div>
  );
}
