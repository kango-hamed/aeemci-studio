/**
 * Sonde de santé /api/sante : le mode léger (`?base=non`, healthcheck Docker) ne touche pas à la base,
 * pour que Neon se mette en veille ; le mode complet interroge toujours la base. Base simulée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/serveur/db", () => ({ db: { execute: base.execute } }));

const { GET } = await import("@/app/api/sante/route");
const demander = (suite = "") => GET(new Request(`http://127.0.0.1:8080/api/sante${suite}`));

describe("/api/sante", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://essai");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");
    vi.stubEnv("BETTER_AUTH_URL", "http://127.0.0.1:8080");
    vi.stubEnv("STOCKAGE", "local");
    base.execute.mockReset().mockResolvedValue({ rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("mode léger : répond sans interroger la base", async () => {
    const r = await demander("?base=non");
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ etat: "ok", base: "non vérifiée" });
    expect(base.execute).not.toHaveBeenCalled();
  });

  it("mode léger : reste « ok » quand la base est injoignable (pas de redémarrage pour une panne de Neon)", async () => {
    base.execute.mockRejectedValue(new Error("53000"));
    const r = await demander("?base=non");
    expect(r.status).toBe(200);
    expect(base.execute).not.toHaveBeenCalled();
  });

  it("mode léger : 503 quand la configuration est incomplète", async () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    const r = await demander("?base=non");
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ etat: "configuration incomplète", manquantes: ["BETTER_AUTH_SECRET"] });
    expect(base.execute).not.toHaveBeenCalled();
  });

  it("mode complet : interroge la base", async () => {
    const r = await demander();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ etat: "ok", stockage: "local" });
    expect(base.execute).toHaveBeenCalledTimes(1);
  });

  it("mode complet : 503 quand la base est injoignable", async () => {
    base.execute.mockRejectedValue(new Error("53000"));
    const r = await demander();
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ etat: "base injoignable" });
  });

  it("une autre valeur que « non » garde le mode complet", async () => {
    await demander("?base=oui");
    expect(base.execute).toHaveBeenCalledTimes(1);
  });
});
