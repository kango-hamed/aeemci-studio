/** Libellés des rôles, tels que les membres les nomment. */
export const LIBELLES_ROLES = {
  president: "Président",
  vice_president: "Vice-président",
  secretaire_general: "Secrétaire général",
  responsable_delegation: "Responsable de délégation",
  membre: "Membre",
} as const;

export type Role = keyof typeof LIBELLES_ROLES;

export const ROLES = Object.keys(LIBELLES_ROLES) as Role[];

/** Rôles du bureau exécutif : ils gèrent l'organisation et voient tous les documents. Sans délégation. */
export const ROLES_BUREAU: readonly Role[] = ["president", "vice_president", "secretaire_general"];

export function estRoleBureau(role: Role): boolean {
  return ROLES_BUREAU.includes(role);
}
