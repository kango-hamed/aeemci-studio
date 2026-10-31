import "server-only";
import { crc32 } from "node:zlib";

/**
 * Archive ZIP sans compression (méthode « stored ») : assez pour regrouper des PDF, déjà compressés.
 * Noms en UTF-8 (bit 11), pas de ZIP64 : quelques dizaines de fichiers de quelques centaines de Ko.
 */
export function creerZip(fichiers: { nom: string; contenu: Buffer }[], date = new Date()): Buffer {
  // Heure et date au format DOS (heure locale du serveur, à 2 secondes près).
  const heureDos = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dateDos = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locaux: Buffer[] = [];
  const central: Buffer[] = [];
  let position = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const crc = crc32(f.contenu);
    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4); // version requise
    entete.writeUInt16LE(0x0800, 6); // noms en UTF-8
    entete.writeUInt16LE(0, 8); // stored
    entete.writeUInt16LE(heureDos, 10);
    entete.writeUInt16LE(dateDos, 12);
    entete.writeUInt32LE(crc, 14);
    entete.writeUInt32LE(f.contenu.length, 18);
    entete.writeUInt32LE(f.contenu.length, 22);
    entete.writeUInt16LE(nom.length, 26);
    entete.writeUInt16LE(0, 28);
    locaux.push(entete, nom, f.contenu);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(0, 10);
    c.writeUInt16LE(heureDos, 12);
    c.writeUInt16LE(dateDos, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(f.contenu.length, 20);
    c.writeUInt32LE(f.contenu.length, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(position, 42);
    central.push(c, nom);
    position += 30 + nom.length + f.contenu.length;
  }
  const tailleCentral = central.reduce((n, b) => n + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(position, 16);
  return Buffer.concat([...locaux, ...central, fin]);
}
