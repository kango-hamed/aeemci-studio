#!/usr/bin/env node
/**
 * Atelier AEEMCI Studio : finalisation d'un gabarit produit par le plugin Photoshop.
 *
 *   node atelier/src/serveur.ts --dossier <dossier du plugin> [--polices polices.json] [--port 4321]
 *
 * Écoute UNIQUEMENT sur 127.0.0.1. Le gabarit publié est écrit dans le dossier :
 * `gabarit.publie.json` (le manifest du plugin n'est jamais modifié).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { parseArgs } from "node:util";
import { CataloguePolices, chromium, ErreurRendu, rendrePlan, type Browser, type Gabarit, type Valeurs } from "../../../packages/moteur/src/index.ts";
import { controlerGabarit, valeursEssai } from "./controles.ts";

export const FICHIER_PUBLIE = "gabarit.publie.json";
const TAILLE_MAX_REQUETE = 40 * 1024 * 1024; // photos en data: URL

export interface Publication {
  format: "aeemci-studio/gabarit-publie";
  revision: number;
  publie_le: string;
  nom: string;
  description?: string;
  source: { manifest: string; nom_fichier?: string; generateur?: unknown };
  gabarit: Gabarit;
}

export interface OptionsAtelier {
  dossier: string;
  polices: CataloguePolices;
  port?: number;
  navigateur?: Browser;
}

function lireJson<T>(chemin: string): T {
  return JSON.parse(fs.readFileSync(chemin, "utf8")) as T;
}

/** État initial : la dernière publication si elle existe, sinon le gabarit du manifest. */
export function chargerDossier(dossier: string) {
  const manifest = lireJson<Record<string, any>>(path.join(dossier, "manifest.json"));
  if (!manifest.gabarit) throw new Error("Ce manifest n'a pas de section « gabarit » : marque des calques dans le plugin puis génère de nouveau.");
  const cheminPublie = path.join(dossier, FICHIER_PUBLIE);
  const publie = fs.existsSync(cheminPublie) ? lireJson<Publication>(cheminPublie) : null;
  return {
    manifest,
    publie,
    gabarit: (publie?.gabarit ?? manifest.gabarit) as Gabarit,
    nom: publie?.nom ?? String(manifest.document?.nom_fichier ?? "Gabarit").replace(/\.[^.]+$/, ""),
    description: publie?.description ?? "",
  };
}

function lireCorps(req: http.IncomingMessage): Promise<any> {
  return new Promise((ok, ko) => {
    let taille = 0;
    const morceaux: Buffer[] = [];
    req.on("data", (m: Buffer) => {
      taille += m.length;
      if (taille > TAILLE_MAX_REQUETE) {
        ko(new Error("Requête trop volumineuse."));
        req.destroy();
      } else morceaux.push(m);
    });
    req.on("end", () => {
      try {
        ok(morceaux.length ? JSON.parse(Buffer.concat(morceaux).toString("utf8")) : {});
      } catch {
        ko(new Error("JSON invalide."));
      }
    });
    req.on("error", ko);
  });
}

function json(res: http.ServerResponse, statut: number, corps: unknown) {
  res.writeHead(statut, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(corps));
}

export async function demarrerAtelier(o: OptionsAtelier): Promise<{ serveur: http.Server; url: string; fermer: () => Promise<void> }> {
  const dossier = path.resolve(o.dossier);
  chargerDossier(dossier); // échoue tôt si le dossier n'est pas un gabarit
  const navigateur = o.navigateur ?? (await chromium.launch());
  const page = fs.readFileSync(path.join(import.meta.dirname, "../public/index.html"));

  const serveur = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(page);
      }
      if (req.method === "GET" && url.pathname === "/api/etat") {
        const d = chargerDossier(dossier);
        return json(res, 200, {
          dossier,
          nom: d.nom,
          description: d.description,
          document: d.manifest.document,
          gabarit: d.gabarit,
          avertissements: (d.manifest.avertissements ?? []).filter((a: string) => !/^Image incorporée/.test(a)),
          revision: d.publie?.revision ?? 0,
          publie_le: d.publie?.publie_le ?? null,
          controles: controlerGabarit(d.gabarit, o.polices, dossier),
        });
      }
      if (req.method === "POST" && url.pathname === "/api/controler") {
        const { gabarit } = await lireCorps(req);
        return json(res, 200, controlerGabarit(gabarit, o.polices, dossier));
      }
      if (req.method === "POST" && url.pathname === "/api/essai") {
        const { gabarit, mode } = await lireCorps(req);
        return json(res, 200, valeursEssai(gabarit, mode === "long" ? "long" : "exemple"));
      }
      if (req.method === "POST" && url.pathname === "/api/apercu") {
        const { gabarit, valeurs, plan, largeur } = (await lireCorps(req)) as { gabarit: Gabarit; valeurs: Valeurs; plan?: string; largeur?: number };
        try {
          const r = await rendrePlan({ gabarit, dossier, valeurs, polices: o.polices, plan, largeurSortie: Math.min(Math.max(Number(largeur) || 720, 200), 2000), navigateur });
          res.writeHead(200, {
            "content-type": "image/png",
            "cache-control": "no-store",
            "x-rapport": Buffer.from(JSON.stringify(r.rapport), "utf8").toString("base64"),
          });
          return res.end(r.fichier);
        } catch (e) {
          if (e instanceof ErreurRendu) return json(res, 422, { message: e.message, erreurs: e.erreurs });
          throw e;
        }
      }
      if (req.method === "POST" && url.pathname === "/api/publier") {
        const { gabarit, nom, description } = (await lireCorps(req)) as { gabarit: Gabarit; nom?: string; description?: string };
        const controles = controlerGabarit(gabarit, o.polices, dossier);
        if (controles.bloquants.length) return json(res, 422, { message: "Publication impossible : corrige d'abord les points bloquants.", controles });
        const d = chargerDossier(dossier);
        const publication: Publication = {
          format: "aeemci-studio/gabarit-publie",
          revision: (d.publie?.revision ?? 0) + 1,
          publie_le: new Date().toISOString(),
          nom: String(nom || d.nom).trim(),
          ...(description && String(description).trim() ? { description: String(description).trim() } : {}),
          source: { manifest: "manifest.json", nom_fichier: d.manifest.document?.nom_fichier, generateur: d.manifest.generateur },
          gabarit,
        };
        fs.writeFileSync(path.join(dossier, FICHIER_PUBLIE), JSON.stringify(publication, null, 2) + "\n");
        return json(res, 200, { fichier: path.join(dossier, FICHIER_PUBLIE), revision: publication.revision, publie_le: publication.publie_le, remarques: controles.remarques });
      }
      json(res, 404, { message: "Introuvable." });
    } catch (e) {
      json(res, 500, { message: e instanceof Error ? e.message : String(e) });
    }
  });

  await new Promise<void>((ok) => serveur.listen(o.port ?? 4321, "127.0.0.1", ok));
  const adresse = serveur.address();
  const port = typeof adresse === "object" && adresse ? adresse.port : o.port;
  return {
    serveur,
    url: `http://127.0.0.1:${port}/`,
    fermer: async () => {
      await new Promise<void>((ok) => serveur.close(() => ok()));
      if (!o.navigateur) await navigateur.close();
    },
  };
}

// Lancement en ligne de commande
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const { values: a } = parseArgs({ options: { dossier: { type: "string" }, polices: { type: "string" }, port: { type: "string", default: "4321" } } });
  if (!a.dossier) {
    console.error("Usage : node atelier/src/serveur.ts --dossier <dossier produit par le plugin> [--polices polices.json] [--port 4321]");
    process.exit(2);
  }
  const polices = CataloguePolices.depuisFichier(a.polices ?? path.join(import.meta.dirname, "../../../packages/moteur/polices/polices.json"));
  const { url } = await demarrerAtelier({ dossier: a.dossier, polices, port: Number(a.port) });
  console.log(`Atelier ouvert : ${url}  (Ctrl+C pour arrêter)`);
}
