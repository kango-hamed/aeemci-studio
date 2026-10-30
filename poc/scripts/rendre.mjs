import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
const [nom, sortie, calquesCsv, remplacements] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(nom + '.textes.json'));
const fonts = {
  'Outfit-Regular': ['Outfit', 400, 'outfit/files/outfit-latin-400-normal.woff2'],
  'Outfit-Black': ['Outfit', 900, 'outfit/files/outfit-latin-900-normal.woff2'],
  'Montserrat-Bold': ['Montserrat', 700, 'montserrat/files/montserrat-latin-700-normal.woff2'],
  'Montserrat-Medium': ['Montserrat', 500, 'montserrat/files/montserrat-latin-500-normal.woff2'],
  'Montserrat-Black': ['Montserrat', 900, 'montserrat/files/montserrat-latin-900-normal.woff2'],
};
const css = Object.values(fonts).map(([fam, w, p]) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync('node_modules/@fontsource/' + p).toString('base64')})}`).join('');

const esc = x => x.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Plages de style (police par segment) et retours à la ligne (\r) → <tspan>
function contenu(t, texte, remplace, tx, size, k, boite, al) {
  const runs = (!remplace && t.runs.length) ? t.runs : [{ length: texte.length, font: t.style.font?.name || t.runs[0]?.font }];
  const lead = (t.style.leading && t.style.leading > 1 ? t.style.leading : size * 1.2 / k) * k;
  const xLigne = tx + (boite ? (al === 'center' ? boite / 2 : al === 'right' ? boite : 0) : 0);
  let i = 0, out = '', premiere = true;
  for (const r of runs) {
    const seg = (remplace ? texte : t.texte).slice(i, i + r.length); i += r.length;
    const [fam, w] = fonts[r.font] || fonts[t.style.font?.name] || ['Montserrat', 500];
    const parts = seg.replace(/[\r\n]$/, '').split(/\r|\n/);
    parts.forEach((p, j) => {
      const saut = j > 0;
      out += `<tspan font-family="${fam}" font-weight="${w}"${saut ? ` x="${xLigne}" dy="${lead}"` : ''}>${esc(p)}</tspan>`;
    });
  }
  return out;
}

const rep = remplacements ? JSON.parse(remplacements) : {};
const calques = calquesCsv.split('|');
const anchor = { left: 'start', center: 'middle', right: 'end' };
const textes = data.textes.filter(t => calques.includes(t.calque)).map(t => {
  const [a, b, c, d, tx, ty] = t.transform; const k = Math.hypot(c, d);
  const fn = t.style.font?.name || t.runs[0]?.font; const [fam, w] = fonts[fn];
  const size = t.style.fontSize * k, fb = t.style.fauxBold ? +(process.env.FB || 0.03) : 0, ls = (t.style.tracking || 0) / 1000 * size + fb * size * +(process.env.FBA || 1);
  const al = t.paragraphe?.justification || 'left';
  const remplace = rep[t.calque];
  const texte = remplace ?? t.texte;
  const couleur = (remplace||process.env.MASQUE) ? '#000' : 'rgba(255,0,0,.75)';
  // Ajustement : largeur max = largeur des bornes d'origine * 1.15 si remplacé
  const maxW = remplace ? (t.bornes[2] - t.bornes[0]) * 1.15 : 0;
  const boite = t.forme === 'box' ? t.boite[2] * k : 0; const x = tx + (boite ? (al === 'center' ? boite / 2 : al === 'right' ? boite : 0) : 0) + (al === 'center' ? ls : 0);
  return `<text x="${x}" y="${ty}" data-boite="${boite ? 1 : 0}" data-max="${maxW}" data-size="${size}" font-family="${fam}" font-weight="${w}" font-size="${size}" letter-spacing="${ls}" text-anchor="${anchor[al]}" fill="${couleur}" stroke="${fb ? couleur : 'none'}" stroke-width="${fb * size}" stroke-linejoin="round">${contenu(t, texte, remplace, tx, size, k, boite, al)}</text>`;
}).join('\n');
const masque = process.env.MASQUE; const fond = (remplacements||masque) ? 'none' : `url(data:image/png;base64,${fs.readFileSync(nom + '.png').toString('base64')})`;
const html = `<html><head><style>${css} body{margin:0} #p{width:${data.largeur}px;height:${data.hauteur}px;background:${fond} ${masque?'#fff':'#f7e9d6'};}</style></head><body><svg id="p" width="${data.largeur}" height="${data.hauteur}" xmlns="http://www.w3.org/2000/svg">${textes}</svg>
<script>document.fonts.ready.then(()=>{const cx=document.createElement('canvas').getContext('2d');for(const t of document.querySelectorAll('text[data-boite="1"]')){cx.font=t.getAttribute('font-weight')+' '+t.getAttribute('font-size')+'px '+t.getAttribute('font-family');const a=cx.measureText('Hg').actualBoundingBoxAscent;t.setAttribute('y',+t.getAttribute('y')+a*(+(window.ASC||1)));}for(const t of document.querySelectorAll('text')){const m=+t.dataset.max;if(!m)continue;let s=+t.dataset.size;const min=s*0.55;while(t.getComputedTextLength()>m&&s>min){s-=1;t.setAttribute('font-size',s);t.setAttribute('letter-spacing',s*0.1);}t.dataset.final=s;}document.body.dataset.pret=1})</script></body></html>`;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: data.largeur, height: data.hauteur } });
await p.setContent(html); await p.waitForSelector('body[data-pret]');
console.log(await p.$$eval('text', ts => ts.map(t => t.textContent + ' → ' + (t.dataset.final || t.getAttribute('font-size')))));
await p.screenshot({ path: sortie, clip: { x: 0, y: 0, width: data.largeur, height: data.hauteur } }); await b.close();
