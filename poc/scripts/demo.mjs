// Rendu du gabarit « membre retenu » : fond (calque nom retiré) + zone dynamique « nom » avec ajustement.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const g = JSON.parse(fs.readFileSync('gabarit-membre-retenu.json'));
const plan = g.gabarit.plans[0];
const font = (fam, w, p) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/' + p).toString('base64')})}`;
const css = font('Outfit', 400, 'outfit/files/outfit-latin-400-normal.woff2');
const fond = 'data:image/png;base64,' + fs.readFileSync(plan.fond).toString('base64');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: plan.largeur_px, height: plan.hauteur_px } });
for (const [i, valeurs] of JSON.parse(process.argv[2]).entries()) {
  const zones = plan.zones.map(z => { const t = z.texte; const anchor = { gauche: 'start', centre: 'middle', droite: 'end' }[t.alignement];
    return `<text data-max="${z.largeur_max}" data-min="${z.debordement.taille_min_px}" data-ap="${t.approche_em}" data-fb="${t.faux_gras ? 0.03 : 0}" x="${z.ancre.x}" y="${z.ancre.ligne_de_base}" text-anchor="${anchor}" font-family="${t.famille}" font-weight="${t.graisse}" font-size="${t.taille_px}" fill="${t.couleur}">${valeurs[z.champ].replace(/&/g,'&amp;').replace(/</g,'&lt;')}</text>`; }).join('');
  await p.setContent(`<html><head><style>${css}body{margin:0}</style></head><body><svg width="${plan.largeur_px}" height="${plan.hauteur_px}"><image href="${fond}" width="${plan.largeur_px}" height="${plan.hauteur_px}"/>${zones}</svg>
  <script>document.fonts.ready.then(()=>{for(const t of document.querySelectorAll('text')){let s=+t.getAttribute('font-size');const x0=+t.getAttribute('x');const set=()=>{const ls=s*(+t.dataset.ap+ +t.dataset.fb);t.setAttribute('font-size',s);t.setAttribute('letter-spacing',ls);t.setAttribute('x',x0+(t.getAttribute('text-anchor')==='middle'?ls:0));};set();while(t.getComputedTextLength()>+t.dataset.max&&s>+t.dataset.min){s-=0.5;set();}}document.body.dataset.pret=1})</script></body></html>`);
  await p.waitForSelector('body[data-pret]');
  await p.screenshot({ path: `rendu-${i + 1}.png` });
}
await b.close();
