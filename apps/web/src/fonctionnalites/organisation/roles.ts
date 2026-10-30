/** Libellés des rôles, tels que les membres les nomment. */
export const LIBELLES_ROLES = {
  president: "Président",
  vice_president: "Vice-président",
  secretaire_general: "Secrétaire général",
  responsable_delegation: "Responsable de délégation",
  membre: "Membre",
} as const;

export type Role = keyof typeof LIBELLES_ROLES;
