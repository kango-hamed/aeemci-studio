"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/serveur/auth";
import { destinationSure } from "./destination";

export interface EtatConnexion {
  erreur?: string;
  email?: string;
}

const Identifiants = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Saisis une adresse e-mail valide.")),
  motDePasse: z.string().min(1, "Saisis ton mot de passe."),
});

export async function seConnecter(_etat: EtatConnexion, formulaire: FormData): Promise<EtatConnexion> {
  const saisie = Identifiants.safeParse({ email: formulaire.get("email"), motDePasse: formulaire.get("motDePasse") });
  const email = typeof formulaire.get("email") === "string" ? String(formulaire.get("email")) : "";
  if (!saisie.success) return { erreur: saisie.error.issues[0]?.message, email };

  try {
    await auth.api.signInEmail({ body: { email: saisie.data.email, password: saisie.data.motDePasse }, headers: await headers() });
  } catch (e) {
    if (e instanceof APIError) {
      if (e.status === "TOO_MANY_REQUESTS") return { erreur: "Trop de tentatives. Réessaie dans une minute.", email };
      return { erreur: "Adresse e-mail ou mot de passe incorrect.", email };
    }
    throw e;
  }
  redirect(destinationSure(formulaire.get("suite")));
}

export async function seDeconnecter(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/connexion");
}
