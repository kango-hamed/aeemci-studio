import { readPsd } from 'ag-psd';
import fs from 'node:fs';
const f = process.argv[2];
const t0 = Date.now();
const psd = readPsd(fs.readFileSync(f), { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
const rgb = c => c && 'r' in c ? '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase() : undefined;
const out = { fichier: f, w: psd.width, h: psd.height, ms: 0, plans: [], textes: [], objets: [], nbCalques: 0, effetsTexte: 0 };
function walk(ls, chemin, plan) {
  for (const l of ls || []) {
    out.nbCalques++;
    let p = plan;
    if (l.artboard) { p = l.name; out.plans.push({ nom: l.name, rect: l.artboard.rect }); }
    if (l.text) {
      const t = l.text, s = t.style || {}, tr = t.transform || [1, 0, 0, 1, 0, 0];
      const echelle = Math.sqrt(tr[2] * tr[2] + tr[3] * tr[3]);
      const polices = [...new Set((t.styleRuns || []).map(r => r.style?.font?.name).concat(s.font?.name).filter(Boolean))];
      if (l.effects && Object.keys(l.effects).length) out.effetsTexte++;
      out.textes.push({
        calque: l.name, plan: p, chemin: chemin.join(' / '), masque: !!l.hidden,
        texte: (t.text || '').replace(/\r/g, '⏎').slice(0, 70),
        forme: t.shapeType, boite: t.boxBounds, bornes: [l.left, l.top, l.right, l.bottom],
        police: polices, taille: s.fontSize && +(s.fontSize * echelle).toFixed(1), interlignage: s.leading && +(s.leading * echelle).toFixed(1),
        approche: s.tracking, couleur: rgb(s.fillColor), alignement: t.paragraphStyle?.justification,
        rotation: Math.abs(tr[1]) > 1e-3 ? 'oui' : undefined, plages: (t.styleRuns || []).length,
        effets: l.effects ? Object.keys(l.effects).filter(k => k !== 'scale') : undefined,
        warp: t.warp?.style && t.warp.style !== 'none' ? t.warp.style : undefined,
      });
    }
    if (l.placedLayer) out.objets.push({ calque: l.name, plan: p, type: l.placedLayer.type, bornes: [l.left, l.top, l.right, l.bottom] });
    if (l.children) walk(l.children, [...chemin, l.name], p);
  }
}
walk(psd.children, [], null);
out.ms = Date.now() - t0;
console.log(JSON.stringify(out, null, 1));
