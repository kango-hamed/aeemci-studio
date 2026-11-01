"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, BellOff, Check, Loader2, Send } from "lucide-react";
import { abonner, desabonner, enregistrerPreferences, essayer, type PreferencesNotification } from "./actions";

type Etat = "lecture" | "non-pris-en-charge" | "a-installer" | "sans-service" | "refusees" | "inactives" | "actives";

/** Clé publique VAPID (base64url) au format attendu par `pushManager.subscribe`. */
function enOctets(cle: string): Uint8Array<ArrayBuffer> {
  const b64 = (cle + "=".repeat((4 - (cle.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** « Android · Chrome »… pour reconnaître l'appareil. */
function nomAppareil(): string {
  const ua = navigator.userAgent;
  const systeme = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "Ordinateur";
  const navigateur = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /SamsungBrowser/.test(ua) ? "Samsung" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [systeme, navigateur].filter(Boolean).join(" · ");
}

async function enregistrementServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

const bouton = "flex min-h-12 items-center justify-center gap-2 rounded-m px-5 font-semibold disabled:opacity-70";

export function ReglageNotifications({
  clePublique,
  preferences,
  estValideur,
}: {
  clePublique: string | null;
  preferences: PreferencesNotification;
  estValideur: boolean;
}) {
  const [etat, setEtat] = useState<Etat>("lecture");
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ texte: string; erreur?: boolean } | null>(null);
  const [choix, setChoix] = useState(preferences);
  const [enregistre, setEnregistre] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const ios = /iPhone|iPad/.test(navigator.userAgent);
        setEtat(ios && !window.matchMedia("(display-mode: standalone)").matches ? "a-installer" : "non-pris-en-charge");
        return;
      }
      if (Notification.permission === "denied") return setEtat("refusees");
      const reg = await enregistrementServiceWorker();
      if (!reg) return setEtat("sans-service");
      setEtat((await reg.pushManager.getSubscription()) ? "actives" : "inactives");
    })();
  }, []);

  async function activer() {
    if (!clePublique) return;
    setOccupe(true);
    setMessage(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setEtat("refusees");
        return;
      }
      const reg = await enregistrementServiceWorker();
      if (!reg) return setEtat("sans-service");
      const abonnement = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: enOctets(clePublique) }));
      const r = await abonner(abonnement.toJSON(), nomAppareil());
      if (r.erreur) setMessage({ texte: r.erreur, erreur: true });
      else {
        setEtat("actives");
        setMessage({ texte: "Notifications activées sur cet appareil." });
      }
    } catch {
      setMessage({ texte: "Le navigateur n'a pas pu activer les notifications. Réessaie dans un instant.", erreur: true });
    } finally {
      setOccupe(false);
    }
  }

  async function desactiver() {
    setOccupe(true);
    setMessage(null);
    const abonnement = await (await enregistrementServiceWorker())?.pushManager.getSubscription();
    if (abonnement) {
      await desabonner(abonnement.endpoint);
      await abonnement.unsubscribe().catch(() => {});
    }
    setEtat("inactives");
    setOccupe(false);
  }

  async function tester() {
    setOccupe(true);
    const r = await essayer();
    setMessage(r.erreur ? { texte: r.erreur, erreur: true } : r.recus ? { texte: "Essai envoyé : la notification arrive dans quelques secondes." } : { texte: "Aucun appareil n'a reçu l'essai.", erreur: true });
    setOccupe(false);
  }

  async function changer(cle: keyof PreferencesNotification, valeur: boolean) {
    const suivant = { ...choix, [cle]: valeur };
    setChoix(suivant);
    setEnregistre(false);
    await enregistrerPreferences(suivant);
    setEnregistre(true);
  }

  const explications: Partial<Record<Etat, string>> = {
    "non-pris-en-charge": "Ce navigateur ne reçoit pas les notifications. Sur téléphone, installe l'application depuis Chrome (Android) ou Safari (iPhone).",
    "a-installer": "Sur iPhone, les notifications n'arrivent que dans l'application installée : dans Safari, touche Partager puis « Sur l'écran d'accueil », et ouvre AEEMCI depuis son icône.",
    "sans-service": "Les notifications se règlent depuis l'application en ligne (elles ne sont pas disponibles ici).",
    refusees: "Les notifications sont bloquées pour AEEMCI Studio. Autorise-les dans les réglages du navigateur ou du téléphone (Notifications), puis reviens ici.",
  };

  const types: { cle: keyof PreferencesNotification; libelle: string; detail: string }[] = [
    ...(estValideur ? [{ cle: "aValider" as const, libelle: "Document à valider", detail: "Quand un document officiel t'est soumis." }] : []),
    { cle: "decision", libelle: "Document validé ou à corriger", detail: "Quand le président valide ton document ou te le renvoie." },
    { cle: "partage", libelle: "Nouveau document partagé", detail: "Quand un membre publie un document pour ta délégation ou toute la section." },
    { cle: "rappel", libelle: "Rappel d'activité", detail: "La veille d'une activité qui te concerne." },
  ];

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-l border border-trait bg-surface-relevee p-5 shadow-carte" aria-labelledby="notif-appareil">
        <h2 id="notif-appareil" className="titre-2 m-0">
          Sur cet appareil
        </h2>
        {!clePublique ? (
          <p className="m-0 text-encre-douce">Les notifications ne sont pas encore activées sur la plateforme.</p>
        ) : etat === "lecture" ? (
          <p className="m-0 flex items-center gap-2 text-encre-douce">
            <Loader2 size={18} aria-hidden className="animate-spin" /> Vérification…
          </p>
        ) : explications[etat] ? (
          <p className="m-0 flex gap-2 rounded-m bg-creme p-3.5 text-sm leading-5">
            <AlertTriangle size={18} aria-hidden className="mt-px shrink-0 text-orange-texte" />
            {explications[etat]}
          </p>
        ) : (
          <>
            <p className="m-0 flex items-center gap-2 font-semibold">
              {etat === "actives" ? <Bell size={20} aria-hidden className="text-vert-esatic" /> : <BellOff size={20} aria-hidden className="text-encre-douce" />}
              {etat === "actives" ? "Notifications activées" : "Notifications désactivées"}
            </p>
            <div className="flex flex-wrap gap-2">
              {etat === "actives" ? (
                <>
                  <button type="button" disabled={occupe} onClick={() => void tester()} className={`${bouton} bg-vert-esatic text-sur-vert`}>
                    <Send size={18} aria-hidden /> Envoyer un essai
                  </button>
                  <button type="button" disabled={occupe} onClick={() => void desactiver()} className={`${bouton} border border-trait text-encre`}>
                    Désactiver
                  </button>
                </>
              ) : (
                <button type="button" disabled={occupe} onClick={() => void activer()} className={`${bouton} bg-vert-esatic text-sur-vert`}>
                  {occupe ? <Loader2 size={18} aria-hidden className="animate-spin" /> : <Bell size={18} aria-hidden />} Activer les notifications
                </button>
              )}
            </div>
          </>
        )}
        {message && (
          <p role={message.erreur ? "alert" : "status"} className={`m-0 text-sm ${message.erreur ? "text-danger" : "text-vert-esatic"}`}>
            {message.texte}
          </p>
        )}
      </section>

      <fieldset className="m-0 flex flex-col gap-1 rounded-l border border-trait p-5">
        <legend className="px-1 font-semibold">Ce que tu reçois</legend>
        {types.map((t) => (
          <label key={t.cle} className="flex min-h-12 items-start gap-3 py-2">
            <input type="checkbox" checked={choix[t.cle]} onChange={(e) => void changer(t.cle, e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-vert-esatic" />
            <span className="flex flex-col">
              <span className="font-semibold">{t.libelle}</span>
              <span className="text-sm text-encre-douce">{t.detail}</span>
            </span>
          </label>
        ))}
        <p className="m-0 flex h-5 items-center gap-1 text-sm text-vert-esatic" aria-live="polite">
          {enregistre && (
            <>
              <Check size={16} aria-hidden /> Enregistré
            </>
          )}
        </p>
      </fieldset>
    </div>
  );
}
