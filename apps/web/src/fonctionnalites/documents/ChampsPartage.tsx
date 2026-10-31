import { visibilitesPour } from "./partage";

const champ = "min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 text-base text-encre";

/** Visibilité et brouillon, pour la création et le dépôt (champs `visibilite` et `brouillon`). */
export function ChampsPartage({ prefixe, aUneDelegation }: { prefixe: string; aUneDelegation: boolean }) {
  const choix = visibilitesPour(aUneDelegation);
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-m border border-trait p-4">
      <legend className="px-1 font-semibold">Partage</legend>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-visibilite`} className="text-sm font-semibold">
          Qui peut le voir
        </label>
        <select id={`${prefixe}-visibilite`} name="visibilite" defaultValue={aUneDelegation ? "delegation" : "bureau"} className={champ}>
          {choix.map((v) => (
            <option key={v.valeur} value={v.valeur}>
              {v.libelle} : {v.detail}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" name="brouillon" value="1" className="size-5 accent-vert-esatic" />
        <span>
          Garder en brouillon <span className="text-sm text-encre-douce">(toi et le bureau seulement, jusqu&apos;à publication)</span>
        </span>
      </label>
    </fieldset>
  );
}
