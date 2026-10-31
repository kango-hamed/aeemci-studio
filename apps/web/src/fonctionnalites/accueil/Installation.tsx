"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/** Enregistre le service worker (installation, page hors ligne). Rien à afficher. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}

interface InvitationInstallation extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLE_REFUS = "installation-refusee";
const DELAI_REFUS = 30 * 24 * 3600 * 1000;

function refuseeRecemment() {
  try {
    return Date.now() - Number(localStorage.getItem(CLE_REFUS) ?? 0) < DELAI_REFUS;
  } catch {
    return false;
  }
}

/**
 * Invitation à installer l'application sur le téléphone : bouton direct quand le navigateur le permet
 * (Android), sinon la marche à suivre sur iPhone. Rien une fois installée, ni pendant 30 jours après « Plus tard ».
 */
export function InviterInstallation() {
  const [invitation, setInvitation] = useState<InvitationInstallation | null>(null);
  const [iphone, setIphone] = useState(false);
  const [masquee, setMasquee] = useState(true);

  useEffect(() => {
    const installee = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (installee || refuseeRecemment()) return;
    const surIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent);
    const recevoir = (e: Event) => {
      e.preventDefault();
      setInvitation(e as InvitationInstallation);
      setMasquee(false);
    };
    window.addEventListener("beforeinstallprompt", recevoir);
    const installer = () => setMasquee(true);
    window.addEventListener("appinstalled", installer);
    // Lecture de l'appareil après le premier rendu (inconnu côté serveur).
    if (surIos) queueMicrotask(() => {
      setIphone(true);
      setMasquee(false);
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", recevoir);
      window.removeEventListener("appinstalled", installer);
    };
  }, []);

  if (masquee || (!invitation && !iphone)) return null;

  const plusTard = () => {
    try {
      localStorage.setItem(CLE_REFUS, String(Date.now()));
    } catch {}
    setMasquee(true);
  };

  return (
    <aside aria-label="Installer l'application" className="flex items-start gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte lg:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- petite icône publique */}
      <img src="/icone-192.png" alt="" width={48} height={48} className="size-12 shrink-0 rounded-m" />
      <div className="flex min-w-0 flex-auto flex-col gap-2">
        <p className="m-0 font-semibold">Installe AEEMCI Studio sur ton téléphone</p>
        {invitation ? (
          <>
            <p className="m-0 text-sm text-encre-douce">Une icône sur l&apos;écran d&apos;accueil, en plein écran, comme une application.</p>
            <button
              type="button"
              onClick={async () => {
                await invitation.prompt();
                if ((await invitation.userChoice).outcome === "accepted") setMasquee(true);
                setInvitation(null);
              }}
              className="flex min-h-11 items-center gap-2 self-start rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert"
            >
              <Download size={18} aria-hidden />
              Installer
            </button>
          </>
        ) : (
          <p className="m-0 text-sm text-encre-douce">
            Dans Safari, touche <Share size={16} aria-label="Partager" className="inline align-[-3px]" /> Partager, puis « Sur l&apos;écran d&apos;accueil ».
          </p>
        )}
      </div>
      <button type="button" onClick={plusTard} className="flex size-11 shrink-0 items-center justify-center rounded-full text-encre-douce">
        <X size={20} aria-hidden />
        <span className="sr-only">Plus tard</span>
      </button>
    </aside>
  );
}
