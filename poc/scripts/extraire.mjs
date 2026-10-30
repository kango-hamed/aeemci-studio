// Extrait le composite du PSD (PNG) et les calques texte avec leur transform (ancre de ligne de base).
import { readPsd, initializeCanvas } from 'ag-psd';
const mk = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
initializeCanvas((w, h) => ({ width: w, height: h, getContext: () => ({ createImageData: mk, putImageData() {}, getImageData: (x, y, w2, h2) => mk(w2, h2) }) }), mk);
import { PNG } from 'pngjs';
import fs from 'node:fs';
const [f, sortie] = process.argv.slice(2);
const psd = readPsd(fs.readFileSync(f), { useImageData: true, skipLayerImageData: true, skipThumbnail: true });
const id = psd.imageData;
const png = new PNG({ width: id.width, height: id.height });
png.data = Buffer.from(id.data.buffer, id.data.byteOffset, id.data.byteLength);
fs.writeFileSync(sortie + '.png', PNG.sync.write(png));
const rgb = c => c && 'r' in c ? '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : null;
const textes = [];
(function walk(ls) { for (const l of ls || []) {
  if (l.text && !l.hidden) { const t = l.text; textes.push({ calque: l.name, texte: t.text, transform: t.transform, forme: t.shapeType, boite: t.boxBounds, bornes: [l.left, l.top, l.right, l.bottom], style: { ...t.style, fillColor: rgb(t.style?.fillColor) }, runs: (t.styleRuns||[]).map(r => ({ length: r.length, font: r.style?.font?.name, size: r.style?.fontSize, color: rgb(r.style?.fillColor) })), paragraphe: t.paragraphStyle, effets: l.effects ? Object.keys(l.effects) : null }); }
  if (l.children) walk(l.children);
} })(psd.children);
fs.writeFileSync(sortie + '.textes.json', JSON.stringify({ largeur: psd.width, hauteur: psd.height, textes }, null, 1));
console.log('ok', psd.width, psd.height, textes.length);
