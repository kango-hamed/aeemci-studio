"use client";

import { useState } from "react";
import { estRoleBureau, LIBELLES_ROLES, ROLES, type Role } from "./roles";

export interface OptionDelegation {
  id: string;
  nom: string;
}

export const champ = "min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

/** Rôle et délégation : la délégation n'est demandée que hors bureau exécutif. */
export function ChampsPoste({
  prefixe,
  role: roleInitial = "membre",
  delegationId,
  delegations,
}: {
  prefixe: string;
  role?: Role;
  delegationId?: string | null;
  delegations: OptionDelegation[];
}) {
  const [role, setRole] = useState<Role>(roleInitial);
  const bureau = estRoleBureau(role);
  return (
    <>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <label htmlFor={`${prefixe}-role`} className="text-sm font-semibold">
          Rôle
        </label>
        <select id={`${prefixe}-role`} name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={champ}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {LIBELLES_ROLES[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <label htmlFor={`${prefixe}-delegation`} className="text-sm font-semibold">
          Délégation
        </label>
        {bureau ? (
          <p id={`${prefixe}-delegation`} className="m-0 flex min-h-11 items-center text-encre-douce">
            Bureau exécutif
          </p>
        ) : (
          <select id={`${prefixe}-delegation`} name="delegationId" defaultValue={delegationId ?? ""} required className={champ}>
            <option value="" disabled>
              {delegations.length ? "Choisir…" : "Crée d'abord une délégation"}
            </option>
            {delegations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  );
}

export function MessageErreur({ id, erreur }: { id: string; erreur?: string }) {
  if (!erreur) return null;
  return (
    <p id={id} role="alert" className="m-0 rounded-m bg-fond-danger p-3 text-sm leading-5 text-danger">
      {erreur}
    </p>
  );
}
