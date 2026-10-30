import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { FormulaireConnexion } from "@/fonctionnalites/authentification/FormulaireConnexion";
import { utilisateurCourant } from "@/fonctionnalites/authentification/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function PageConnexion({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  if (await utilisateurCourant()) redirect("/");
  const { suite } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-wrap bg-surface">
      <section className="relative flex flex-[1_1_480px] flex-col justify-between gap-10 overflow-hidden bg-vert-profond p-8 text-sur-vert-profond sm:p-14">
        <span aria-hidden className="absolute -right-[120px] -bottom-[120px] size-[420px] rounded-full bg-orange-croissant" />
        <span aria-hidden className="absolute -right-[60px] -bottom-[40px] size-[380px] rounded-full bg-vert-profond" />
        <span className="relative flex self-start rounded-m bg-surface-relevee px-3.5 py-2.5">
          <Image src="/logo-aeemci-esatic.png" alt="Logo AEEMCI ESATIC" width={81} height={48} priority />
        </span>
        <div className="relative flex max-w-[460px] flex-col gap-4">
          <span lang="ar" dir="rtl" className="self-start font-arabe text-[40px] leading-[1.4] font-bold text-or">
            مَرْحَبًا
          </span>
          <h1 className="m-0 font-titre text-[34px] leading-[40px] font-extrabold tracking-[-0.01em] sm:text-[44px] sm:leading-[48px]">
            Les documents de la section, au même endroit.
          </h1>
          <p className="m-0 text-[17px] leading-[26px] opacity-90">
            Crée les affiches et les courriers de ta délégation, fais-les valider par le président et retrouve tout
            l&apos;historique des mandats.
          </p>
        </div>
        <span className="relative text-sm opacity-85">AEEMCI, pour une identité islamique&nbsp;!</span>
      </section>

      <section className="flex flex-[1_1_420px] items-center justify-center px-6 py-12">
        <FormulaireConnexion suite={suite ?? "/"} />
      </section>
    </div>
  );
}
