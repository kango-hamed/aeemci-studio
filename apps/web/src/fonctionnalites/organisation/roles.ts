/** Libellés des rôles, tels que les membres les nomment. */
export const LIBELLES_ROLES = {
  president: "Président",
  vice_president: "Vice-président",
  secretaire_general: "Secrétaire général",
  responsable_delegation: "Responsable de délégation",
  sous_responsable_delegation: "Sous-responsable de délégation",
  membre: "Membre",
} as const;

export type Role = keyof typeof LIBELLES_ROLES;

export const ROLES = Object.keys(LIBELLES_ROLES) as Role[];

/** Rôles du bureau exécutif : ils gèrent l'organisation et voient tous les documents. Sans délégation. */
export const ROLES_BUREAU: readonly Role[] = ["president", "vice_president", "secretaire_general"];

export function estRoleBureau(role: Role): boolean {
  return ROLES_BUREAU.includes(role);
}

/** Responsable ou sous-responsable : ils dirigent ensemble leur délégation (activités, points en suspens). */
export function dirigeDelegation(role: Role | undefined): boolean {
  return role === "responsable_delegation" || role === "sous_responsable_delegation";
}
