/** Adresse où revenir après la connexion : uniquement une page de l'application, jamais un autre site. */
export function destinationSure(valeur: unknown): string {
  const v = typeof valeur === "string" ? valeur : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}
