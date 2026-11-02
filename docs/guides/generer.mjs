/**
 * Guides par profil en PDF : une carte mentale, puis une fiche pas à pas par branche.
 * Couleurs et polices du design system (apps/web/src/app/globals.css).
 *
 *   node docs/guides/generer.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { GUIDES, VERSION } from "./contenu.mjs";

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, "..", "..");
const enDonnees = (chemin, type) => `data:${type};base64,${readFileSync(join(racine, chemin)).toString("base64")}`;

const police = (famille, fichier, poids) =>
  `@font-face{font-family:${famille};font-weight:${poids};src:url(${enDonnees(`packages/moteur/polices/${fichier}-latin-${poids}-normal.woff2`, "font/woff2")}) format("woff2")}`;
const POLICES = [
  ...[500, 600, 700, 800].map((p) => police("Titre", "montserrat", p)),
  ...[400, 500, 600].map((p) => police("Texte", "outfit", p)),
].join("\n");
const LOGO = enDonnees("apps/web/public/logo-aeemci-esatic.png", "image/png");
const SCEAU = enDonnees("apps/web/public/sceau-aeemci.png", "image/png");

// Une teinte par branche, prise dans la palette.
const TEINTES = ["#185431", "#ea9129", "#1a6012", "#9c5a00", "#0e3320", "#c9a227"];

const echapper = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Les « … » et les {variables} ressortent en gras, les codes en chasse fixe.
const enrichir = (t) =>
  echapper(t)
    .replace(/« ([^»]+?) »/g, '<b class="ui">« $1 »</b>')
    .replace(/(\{[a-z]+\})/g, '<code>$1</code>')
    .replace(/(AEEMCI-ESATIC\/[A-Z]+\/[A-Z]+\/\d{4}\/\d{3})/g, "<code>$1</code>");

const ICONES = {
  astuce: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  savoir: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  chemin: '<path d="m9 18 6-6-6-6"/>',
};
const icone = (nom, classe = "") =>
  `<svg class="ico ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONES[nom]}</svg>`;

const CSS = `
${POLICES}
:root{--surface:#fbfaf4;--releve:#fff;--creme:#fff2d5;--encre:#1f241f;--douce:#5a635b;--trait:#daddd2;--vert:#185431;--profond:#0e3320;--orange:#ea9129;--orange-texte:#9c5a00;--succes:#e6f1e8;
--ombre:0 1px 2px rgba(14,51,32,.08),0 4px 12px rgba(14,51,32,.06)}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box}
html,body{margin:0;background:var(--surface);color:var(--encre);font-family:Texte,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:297mm;height:210mm;padding:11mm 13mm 0;position:relative;overflow:hidden;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
h1,h2,h3{font-family:Titre,sans-serif;margin:0}
code{font-family:Consolas,monospace;font-size:.92em;background:var(--succes);color:var(--profond);padding:0 1.2mm;border-radius:1mm}
b.ui{font-weight:600;color:var(--profond)}
.ico{width:4.6mm;height:4.6mm;flex:none}

/* En-tête de la carte */
.entete{display:flex;align-items:center;gap:6mm;padding:4.5mm 6mm;background:var(--profond);color:#fff;border-radius:5mm;position:relative;overflow:hidden}
.entete::after{content:"";position:absolute;right:-18mm;top:-22mm;width:70mm;height:70mm;border-radius:50%;border:9mm solid rgba(234,145,41,.22)}
.entete .logo{height:15mm;background:#fff;border-radius:3mm;padding:1.5mm 2.5mm}
.entete h1{font-size:23pt;font-weight:800;letter-spacing:-.02em}
.entete p{margin:1mm 0 0;font-size:11pt;color:#d9e8dd}
.entete .badge{margin-left:auto;position:relative;z-index:1;font-family:Titre;font-weight:700;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;background:var(--orange);color:var(--profond);padding:2mm 4mm;border-radius:10mm;white-space:nowrap}

/* Carte mentale */
.carte{flex:1;position:relative;display:grid;grid-template-columns:1fr 64mm 1fr;grid-template-rows:repeat(3,1fr);column-gap:14mm;row-gap:4mm;padding:6mm 0 4mm}
.carte svg.liens{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.centre{grid-column:2;grid-row:1/4;align-self:center;justify-self:center;width:60mm;height:60mm;border-radius:50%;background:radial-gradient(circle at 35% 30%,#1f6b3f,var(--vert) 55%,var(--profond));color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-shadow:0 0 0 3mm var(--surface),0 0 0 4.2mm var(--orange),var(--ombre);position:relative;z-index:1}
.centre img{width:15mm;height:15mm;object-fit:contain;background:#fff;border-radius:50%;padding:1mm;margin-bottom:2mm}
.centre h2{font-size:17pt;font-weight:800}
.centre span{font-size:9.5pt;color:#d9e8dd;margin-top:.5mm}
.branche{align-self:center;background:var(--releve);border:.3mm solid var(--trait);border-radius:4mm;box-shadow:var(--ombre);padding:3.5mm 4.5mm;display:flex;flex-direction:column;gap:2mm;position:relative;z-index:1;border-top:1.6mm solid var(--teinte)}
.branche.gauche{grid-column:1}.branche.droite{grid-column:3}
.branche .tete{display:flex;align-items:center;gap:2.5mm}
.num{flex:none;width:7.5mm;height:7.5mm;border-radius:50%;background:var(--teinte);color:#fff;font-family:Titre;font-weight:800;font-size:10.5pt;display:flex;align-items:center;justify-content:center}
.branche h3{font-size:13pt;font-weight:700;color:var(--profond)}
.branche .renvoi{margin-left:auto;font-size:8.5pt;font-weight:600;color:var(--douce);white-space:nowrap}
.puces{display:flex;flex-wrap:wrap;gap:1.6mm}
.branche .acces{display:flex;flex-wrap:wrap;align-items:center;gap:.6mm;font-size:8.5pt;color:var(--douce);border-top:.25mm dashed var(--trait);padding-top:1.8mm}
.branche .acces b{color:var(--profond);font-weight:600}
.branche .acces .ico{width:3mm;height:3mm}
.puces span{font-size:9.5pt;padding:.9mm 2.6mm;border-radius:10mm;background:color-mix(in srgb,var(--teinte) 11%,#fff);color:var(--encre);border:.25mm solid color-mix(in srgb,var(--teinte) 30%,#fff)}
.mode{text-align:center;font-size:9pt;color:var(--douce);padding-bottom:1mm}
.mode b{color:var(--profond);font-weight:600}

/* Fiches */
.bandeau{display:flex;align-items:center;gap:4mm;padding-bottom:3.5mm;border-bottom:.4mm solid var(--trait)}
.bandeau img{height:9mm}
.bandeau .titre{font-family:Titre;font-weight:700;font-size:11pt;color:var(--profond)}
.bandeau .progres{margin-left:auto;display:flex;gap:1.6mm;align-items:center;font-size:8.5pt;color:var(--douce)}
.progres i{width:6mm;height:1.6mm;border-radius:1mm;background:var(--trait)}
.progres i.vu{background:var(--teinte-pt,var(--vert))}
.fiches{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:7mm;padding:5mm 0 4mm}
.fiche{background:var(--releve);border:.3mm solid var(--trait);border-radius:5mm;box-shadow:var(--ombre);padding:5mm 6mm;display:flex;flex-direction:column;gap:3.5mm;position:relative;overflow:hidden}
.fiche::before{content:"";position:absolute;left:0;top:0;bottom:0;width:1.8mm;background:var(--teinte)}
.fiche .tete{display:flex;align-items:center;gap:3.5mm}
.fiche .grand{font-family:Titre;font-weight:800;font-size:26pt;line-height:1;color:var(--teinte);opacity:.9}
.fiche .tete small{display:block;font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:var(--douce);font-weight:600}
.fiche h2{font-size:15pt;font-weight:800;color:var(--profond);letter-spacing:-.01em}
.chemin{display:flex;flex-wrap:wrap;align-items:center;gap:1mm;font-size:9pt}
.chemin span{background:var(--surface);border:.25mm solid var(--trait);border-radius:1.6mm;padding:.8mm 2.4mm;font-weight:600;color:var(--profond)}
.chemin .ico{width:3.4mm;height:3.4mm;color:var(--douce)}
ol.etapes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3mm;counter-reset:e;flex:1}
ol.etapes li{counter-increment:e;display:flex;gap:3mm;font-size:10.5pt;line-height:1.38;position:relative}
ol.etapes li::before{content:counter(e);flex:none;width:6mm;height:6mm;border-radius:50%;border:.45mm solid var(--teinte);color:var(--teinte);font-family:Titre;font-weight:700;font-size:8.5pt;display:flex;align-items:center;justify-content:center;background:#fff;position:relative;z-index:1}
ol.etapes li:not(:last-child)::after{content:"";position:absolute;left:2.85mm;top:6mm;bottom:-3mm;width:.3mm;background:color-mix(in srgb,var(--teinte) 35%,#fff)}
.encadres{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.encadre{border-radius:3mm;padding:3mm 3.6mm;font-size:9.2pt;line-height:1.36;display:flex;gap:2.2mm}
.encadre strong{display:block;font-family:Titre;font-weight:700;font-size:8pt;letter-spacing:.06em;text-transform:uppercase;margin-bottom:.6mm}
.encadre.astuce{background:var(--creme)}.encadre.astuce .ico,.encadre.astuce strong{color:var(--orange-texte)}
.encadre.savoir{background:var(--succes)}.encadre.savoir .ico,.encadre.savoir strong{color:var(--vert)}

.pied{display:flex;justify-content:space-between;align-items:center;font-size:8pt;color:var(--douce);padding:2.6mm 0 5mm;border-top:.3mm solid var(--trait)}
.pied b{color:var(--vert);font-weight:600}
`;

function pageCarte(g, total) {
  const branches = g.branches
    .map((b, i) => {
      const cote = i < 3 ? "gauche" : "droite";
      const ligne = (i % 3) + 1;
      const page = 2 + Math.floor(i / 2);
      return `<div class="branche ${cote}" style="--teinte:${TEINTES[i]};grid-row:${ligne}" data-i="${i}">
        <div class="tete"><span class="num">${i + 1}</span><h3>${echapper(b.titre)}</h3><span class="renvoi">fiche p. ${page}</span></div>
        <div class="puces">${b.points.map((p) => `<span>${echapper(p)}</span>`).join("")}</div>
        <div class="acces">Accès :&nbsp;${b.chemin.map((c) => `<b>${echapper(c)}</b>`).join(icone("chemin"))}</div>
      </div>`;
    })
    .join("");
  return `<section class="page">
    <header class="entete"><img class="logo" src="${LOGO}" alt=""><div><h1>${echapper(g.titre)}</h1><p>${echapper(g.accroche)}</p></div><span class="badge">Tutoriel · carte mentale</span></header>
    <div class="carte" id="carte"><svg class="liens" id="liens"></svg>
      <div class="centre" id="centre"><img src="${SCEAU}" alt=""><h2>${echapper(g.centre.titre)}</h2><span>${echapper(g.centre.sous)}</span></div>
      ${branches}
    </div>
    <div class="mode">Commence par la branche <b>1</b>, puis suis les numéros. Chaque branche a sa fiche pas à pas dans les pages suivantes.</div>
    ${pied(g, 1, total)}
  </section>`;
}

function fiche(b, i) {
  return `<article class="fiche" style="--teinte:${TEINTES[i]}">
    <div class="tete"><span class="grand">${String(i + 1).padStart(2, "0")}</span><div><small>Branche ${i + 1}</small><h2>${echapper(b.titre)}</h2></div></div>
    <div class="chemin">${b.chemin.map((c) => `<span>${echapper(c)}</span>`).join(icone("chemin"))}</div>
    <ol class="etapes">${b.etapes.map((e) => `<li><span>${enrichir(e)}</span></li>`).join("")}</ol>
    <div class="encadres">
      <div class="encadre astuce">${icone("astuce")}<div><strong>Astuce</strong>${enrichir(b.astuce)}</div></div>
      <div class="encadre savoir">${icone("savoir")}<div><strong>À savoir</strong>${enrichir(b.savoir)}</div></div>
    </div>
  </article>`;
}

function pageFiches(g, debut, numero, total) {
  const progres = g.branches.map((_, i) => `<i class="${i < debut + 2 ? "vu" : ""}" style="--teinte-pt:${TEINTES[i]}"></i>`).join("");
  return `<section class="page">
    <div class="bandeau"><img src="${LOGO}" alt=""><span class="titre">${echapper(g.titre)}</span><span class="progres">Branches ${debut + 1}–${debut + 2} sur ${g.branches.length} ${progres}</span></div>
    <div class="fiches">${g.branches.slice(debut, debut + 2).map((b, k) => fiche(b, debut + k)).join("")}</div>
    ${pied(g, numero, total)}
  </section>`;
}

const pied = (g, n, total) =>
  `<footer class="pied"><span><b>AEEMCI Studio</b> · Section ESATIC · ${echapper(g.titre)}</span><span>${VERSION} · page ${n} / ${total}</span></footer>`;

// Liens de la carte : une courbe du nœud central vers le bord intérieur de chaque branche.
const SCRIPT = `
document.fonts.ready.then(() => {
  const carte = document.getElementById("carte"), svg = document.getElementById("liens"), c = document.getElementById("centre");
  const o = carte.getBoundingClientRect(), r = c.getBoundingClientRect();
  const cx = r.left + r.width / 2 - o.left, cy = r.top + r.height / 2 - o.top, rayon = r.width / 2;
  let traces = "";
  document.querySelectorAll(".branche").forEach((b) => {
    const t = b.getBoundingClientRect(), gauche = b.classList.contains("gauche");
    const x = (gauche ? t.right : t.left) - o.left, y = t.top + t.height / 2 - o.top;
    const ang = Math.atan2(y - cy, x - cx), sx = cx + Math.cos(ang) * (rayon + 4), sy = cy + Math.sin(ang) * (rayon + 4);
    const mx = (sx + x) / 2, teinte = getComputedStyle(b).getPropertyValue("--teinte");
    traces += '<path d="M' + sx + ' ' + sy + ' C' + mx + ' ' + sy + ',' + mx + ' ' + y + ',' + x + ' ' + y + '" fill="none" stroke="' + teinte + '" stroke-width="3" stroke-linecap="round"/>';
    traces += '<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="#fff" stroke="' + teinte + '" stroke-width="3"/>';
  });
  svg.innerHTML = traces;
  window.__pret = true;
});`;

function html(g) {
  const total = 1 + Math.ceil(g.branches.length / 2);
  const pages = [pageCarte(g, total)];
  for (let d = 0; d < g.branches.length; d += 2) pages.push(pageFiches(g, d, 2 + d / 2, total));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${echapper(g.titre)} · AEEMCI Studio</title><style>${CSS}</style></head><body>${pages.join("")}<script>${SCRIPT}</script></body></html>`;
}

const navigateur = await chromium.launch();
try {
  const page = await navigateur.newPage({ viewport: { width: 1123, height: 794 } });
  for (const g of GUIDES) {
    const source = html(g);
    if (process.argv.includes("--html")) writeFileSync(join(ici, `${g.fichier}.html`), source);
    await page.setContent(source, { waitUntil: "load" });
    await page.waitForFunction(() => window.__pret === true);
    // Débordement d'une fiche : à corriger dans le contenu plutôt que de laisser couper le texte.
    const debordes = await page.$$eval(".fiche, .branche", (els) => els.filter((e) => e.scrollHeight > e.clientHeight + 1).map((e) => e.querySelector("h2,h3")?.textContent));
    if (debordes.length) console.warn(`${g.fichier} : déborde → ${debordes.join(", ")}`);
    await page.pdf({ path: join(ici, `${g.fichier}.pdf`), preferCSSPageSize: true, printBackground: true });
    console.log(`${g.fichier}.pdf`);
  }
} finally {
  await navigateur.close();
}
