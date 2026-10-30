"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LienNavigation({ href, aussi = [], children }: { href: string; aussi?: string[]; children: React.ReactNode }) {
  const chemin = usePathname();
  const actif = href === "/" ? chemin === "/" : [href, ...aussi].some((h) => chemin === h || chemin.startsWith(h + "/"));
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={
        "px-3.5 py-2.5 text-sur-vert-profond no-underline " +
        (actif ? "border-b-[3px] border-orange-croissant font-semibold" : "opacity-85 hover:opacity-100")
      }
    >
      {children}
    </Link>
  );
}
