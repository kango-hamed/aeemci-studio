"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";

/** Lien d'activation à transmettre au membre : copie ou partage WhatsApp. Affiché une seule fois. */
export function LienActivation({ jeton, pour }: { jeton: string; pour?: string }) {
  const origine = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const adresse = `${origine}/activer/${jeton}`;
  const [copie, setCopie] = useState(false);

  const message = `Salam ${pour ?? ""} ! Voici ton accès à AEEMCI Studio : choisis ton mot de passe ici (lien valable 7 jours, à usage unique) : ${adresse}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(adresse);
      setCopie(true);
    } catch {
      // Presse-papiers refusé : l'adresse reste sélectionnable dans le champ.
    }
  }

  return (
    <div role="status" className="flex flex-col gap-3 rounded-m border border-vert-esatic bg-fond-succes p-4">
      <p className="m-0 text-sm leading-5">
        <strong>Lien pour {pour ?? "le membre"}</strong> : transmets-le-lui en privé. Il sert une seule fois, pendant 7 jours, et ne sera plus affiché
        ensuite (tu pourras en générer un autre).
      </p>
      <label className="sr-only" htmlFor={`lien-${jeton}`}>
        Lien d&apos;activation
      </label>
      <input
        id={`lien-${jeton}`}
        readOnly
        value={adresse}
        onFocus={(e) => e.currentTarget.select()}
        className="min-h-11 w-full rounded-s border border-trait-champ bg-surface-relevee px-3 font-mono text-sm text-encre"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copier} className="flex min-h-11 items-center gap-2 rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert">
          {copie ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
          {copie ? "Copié" : "Copier le lien"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center gap-2 rounded-m border border-trait-champ px-4 font-semibold text-encre no-underline"
        >
          <MessageCircle size={18} aria-hidden />
          Envoyer par WhatsApp
        </a>
      </div>
    </div>
  );
}
