import path from "node:path";
import { PNG } from "pngjs";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { echapperHtml, LANCEMENT_CHROMIUM, rendreApercuDocument, rendreDocumentPdf, urlRessource } from "../src/index.ts";

const POLICES = path.resolve(import.meta.dirname, "../polices");
const pages = (pdf: Buffer) => pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;

let navigateur: Browser;
beforeAll(async () => {
  navigateur = await chromium.launch(LANCEMENT_CHROMIUM);
});
afterAll(async () => {
  await navigateur?.close();
});

const page = (corps: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:Texte;src:url('${urlRessource("outfit")}')}body{font-family:Texte;font-size:12pt}</style></head><body>${corps}</body></html>`;

describe("mode document", () => {
  it("produit un PDF A4 sur plusieurs pages quand le texte est long", async () => {
    const court = await rendreDocumentPdf({ html: page("<p>Objet : convocation.</p>"), navigateur, pied: "AEEMCI" });
    expect(court.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages(court)).toBe(1);
    const long = await rendreDocumentPdf({ html: page("<p>Paragraphe du procès-verbal.</p>".repeat(200)), navigateur, ressources: { outfit: path.join(POLICES, "outfit-latin-400-normal.woff2") } });
    expect(pages(long)).toBeGreaterThan(2);
  });

  it("sert ses ressources et ne charge rien d'autre", async () => {
    const html = page(`<img id="a" src="${urlRessource("logo")}"><img id="b" src="https://exemple.com/pistage.png">`);
    const png = await rendreApercuDocument({ html, navigateur, largeur: 397, format: "png", ressources: { logo: path.resolve(import.meta.dirname, "../exemples/membre-retenu/photo-test.jpg") } });
    const p = PNG.sync.read(png);
    expect([p.width, p.height]).toEqual([397, 562]);
  });

  it("échappe le texte saisi", () => {
    expect(echapperHtml(`<script>"x" & 'y'</script>`)).toBe("&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;");
  });
});
