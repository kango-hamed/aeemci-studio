import { FileText } from "lucide-react";

/**
 * Sur téléphone, un PDF ne s'affiche pas dans la page : on montre sa première page en image et on
 * l'ouvre dans la visionneuse du téléphone. `pdf` : adresse du fichier ; `miniature` : image de la première page.
 */
export function ApercuPdfMobile({ pdf, miniature, titre, className = "" }: { pdf: string; miniature: string | null; titre: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {miniature && (
        <a href={pdf} target="_blank" rel="noopener" className="block overflow-hidden rounded-l border border-trait bg-white shadow-carte">
          {/* eslint-disable-next-line @next/next/no-img-element -- miniature privée servie par l'API après contrôle de session */}
          <img src={miniature} alt={`Première page de « ${titre} »`} className="block h-auto w-full" />
        </a>
      )}
      <a
        href={pdf}
        target="_blank"
        rel="noopener"
        className="flex min-h-12 items-center justify-center gap-2 rounded-m border border-vert-esatic px-5 font-semibold text-vert-esatic no-underline"
      >
        <FileText size={20} aria-hidden />
        Lire le PDF en entier
      </a>
    </div>
  );
}
