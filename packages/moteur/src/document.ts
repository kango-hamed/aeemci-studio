/**
 * Mode document : HTML mis en page par l'application (lettre, procès-verbal…) → PDF A4 multipage,
 * ou aperçu PNG/JPEG de la première page. Le moteur ne connaît ni la charte ni les types de document ;
 * il fournit la page A4, sert les ressources (polices, logos, signatures) et ajoute le pied de page.
 *
 * Les ressources sont servies par une origine fictive interceptée, comme pour les gabarits : le HTML
 * les désigne par `urlRessource(nom)`, jamais par un chemin local.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";
import { LANCEMENT_CHROMIUM } from "./rendu.ts";

const ORIGINE = "https://document.aeemci.local";
const TYPES_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

/** A4 à 96 ppp, la résolution CSS de Chromium. */
export const A4_PX = { largeur: 794, hauteur: 1123 };

/** Adresse d'une ressource dans le HTML d'un document. */
export function urlRessource(nom: string): string {
  return `${ORIGINE}/r/${encodeURIComponent(nom)}`;
}

/** Échappe un texte saisi avant de l'insérer dans le HTML d'un document. */
export function echapperHtml(texte: string): string {
  return texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export interface OptionsDocument {
  /** Document HTML complet ; les marges de page sont celles de `marges`. */
  html: string;
  /** Ressources servies au HTML : nom → fichier local. */
  ressources?: Record<string, string>;
  /** Texte du pied de page, répété sur chaque page avec « page n / total ». */
  pied?: string;
  /**
   * Pied de page en HTML, à la place de `pied` (PDF seulement). Modèle Chromium : les éléments de classe
   * `pageNumber` et `totalPages` reçoivent les numéros. Le modèle ne charge rien et ne voit pas les polices
   * du document : il déclare les siennes (`@font-face` dans un `<style>`) avec `urlRessource(nom)`, que le moteur
   * remplace par le fichier lui-même ; des noms de famille propres au pied évitent de toucher au document.
   * Le HTML est celui de l'application : tout texte saisi y est déjà échappé.
   */
  piedHtml?: string;
  /** Marges en millimètres. */
  marges?: { haut: number; droite: number; bas: number; gauche: number };
  navigateur?: Browser;
}

const MARGES = { haut: 14, droite: 18, bas: 20, gauche: 18 };

async function avecPage<T>(o: OptionsDocument, f: (page: import("playwright").Page) => Promise<T>, echelle = 1): Promise<T> {
  const navigateur = o.navigateur ?? (await chromium.launch(LANCEMENT_CHROMIUM));
  const page = await navigateur.newPage({ viewport: { width: A4_PX.largeur, height: A4_PX.hauteur }, deviceScaleFactor: echelle });
  try {
    await page.route(`${ORIGINE}/**`, async (route) => {
      const u = new URL(route.request().url());
      if (!u.pathname.startsWith("/r/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>document</title>" });
      const chemin = o.ressources?.[decodeURIComponent(u.pathname.slice(3))];
      if (!chemin || !fs.existsSync(chemin)) return route.fulfill({ status: 404 });
      await route.fulfill({ status: 200, contentType: TYPES_MIME[path.extname(chemin).toLowerCase()] || "application/octet-stream", body: fs.readFileSync(chemin) });
    });
    // Aucune autre requête réseau : un document ne charge que ses ressources.
    await page.route(/^(?!https:\/\/document\.aeemci\.local\/)/, (route) => route.abort());
    await page.goto(`${ORIGINE}/`, { waitUntil: "commit" }).catch(() => undefined);
    await page.setContent(o.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    return await f(page);
  } finally {
    await page.close();
    if (!o.navigateur) await navigateur.close();
  }
}

/** Les `urlRessource(nom)` d'un modèle de pied deviennent des data URI : le modèle ne fait aucune requête. */
function incorporerRessources(html: string, ressources: Record<string, string> = {}): string {
  return html.replace(new RegExp(`${ORIGINE.replace(/\./g, "\\.")}/r/([^'")\\s]+)`, "g"), (url, nom: string) => {
    const chemin = ressources[decodeURIComponent(nom)];
    if (!chemin || !fs.existsSync(chemin)) return url;
    const type = TYPES_MIME[path.extname(chemin).toLowerCase()] || "application/octet-stream";
    return `data:${type};base64,${fs.readFileSync(chemin).toString("base64")}`;
  });
}

/** PDF A4 multipage, pied de page et numéros de page compris. */
export async function rendreDocumentPdf(o: OptionsDocument): Promise<Buffer> {
  const m = o.marges ?? MARGES;
  const pied = echapperHtml(o.pied ?? "");
  const piedHtml = o.piedHtml && incorporerRessources(o.piedHtml, o.ressources);
  return avecPage(o, async (page) => {
    if (piedHtml) {
      // Chromium n'emploie dans le pied qu'une police déjà chargée par la page, à la même adresse :
      // ses styles y sont ajoutés et ses polices chargées avant l'impression.
      const styles = [...piedHtml.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((x) => x[1]).join("\n");
      if (styles) {
        await page.addStyleTag({ content: styles });
        await page.evaluate(() => {
          const chargements: Promise<unknown>[] = [];
          document.fonts.forEach((f) => {
            if (f.status === "unloaded") chargements.push(f.load().catch(() => undefined));
          });
          return Promise.all(chargements);
        });
      }
    }
    return page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: `${m.haut}mm`, right: `${m.droite}mm`, bottom: `${m.bas}mm`, left: `${m.gauche}mm` },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        piedHtml ||
        `<div style="width:100%;margin:0 ${m.gauche}mm;font-family:sans-serif;font-size:8px;color:#5a635b;display:flex;justify-content:space-between;border-top:0.5px solid #daddd2;padding-top:4px"><span>${pied}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
  });
}

/** Aperçu de la première page (miniature), à la largeur demandée. */
export async function rendreApercuDocument(o: OptionsDocument & { largeur: number; format?: "png" | "jpeg" }): Promise<Buffer> {
  const m = o.marges ?? MARGES;
  const mm = A4_PX.largeur / 210;
  return avecPage(
    o,
    async (page) => {
      // Mêmes marges que le PDF : la page d'aperçu est un cadre A4 avec le contenu dans ses marges.
      await page.addStyleTag({ content: `@media screen{body{box-sizing:border-box;margin:0;padding:${m.haut * mm}px ${m.droite * mm}px 0 ${m.gauche * mm}px;width:${A4_PX.largeur}px}}` });
      return page.screenshot({ type: o.format ?? "jpeg", clip: { x: 0, y: 0, width: A4_PX.largeur, height: A4_PX.hauteur }, ...(o.format === "png" ? {} : { quality: 85 }) });
    },
    o.largeur / A4_PX.largeur,
  );
}
