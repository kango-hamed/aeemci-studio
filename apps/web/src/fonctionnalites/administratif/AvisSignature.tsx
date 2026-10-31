import Link from "next/link";
import { PenLine } from "lucide-react";

/** Rappel qu'une signature (ou le cachet) manque, avec le lien vers la page Signature. */
export function AvisSignature({ texte }: { texte: string }) {
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-m bg-fond-attention p-4 text-attention">
      <PenLine size={20} aria-hidden />
      <span className="flex-1">{texte}</span>
      <Link href="/signature" className="font-semibold">
        Enregistrer ma signature
      </Link>
    </p>
  );
}
