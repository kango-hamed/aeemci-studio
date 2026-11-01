"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Download, Share, X } from "lucide-react";

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

function refuseeRecemment(cle = CLE_REFUS) {
  try {
    return Date.now() - Number(localStorage.getItem(cle) ?? 0) < DELAI_REFUS;
  } catch {
    return false;
  }
}

function retenirRefus(cle: string) {
  try {
    localStorage.setItem(cle, String(Date.now()));
  } catch {}
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
    retenirRefus(CLE_REFUS);
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

const CLE_REFUS_NOTIFICATIONS = "notifications-refusees";

/**
 * Dans l'application installée, tant que les notifications n'ont été ni accordées ni bloquées : invitation à
 * les activer (page Notifications). Rien pendant 30 jours après « Plus tard ».
 */
export function InviterNotifications({ disponibles }: { disponibles: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!disponibles || !("PushManager" in window) || !("Notification" in window) || Notification.permission !== "default") return;
    const installee = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (installee && !refuseeRecemment(CLE_REFUS_NOTIFICATIONS)) queueMicrotask(() => setVisible(true));
  }, [disponibles]);

  if (!visible) return null;
  return (
    <aside aria-label="Notifications" className="flex items-start gap-3 rounded-l border border-trait bg-surface-relevee p-4 shadow-carte">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-m bg-creme text-orange-texte">
        <Bell size={24} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-auto flex-col gap-2">
        <p className="m-0 font-semibold">Reçois l&apos;essentiel sur ton téléphone</p>
        <p className="m-0 text-sm text-encre-douce">Un document à valider, une décision, un nouveau partage, une activité le lendemain.</p>
        <Link href="/notifications" className="flex min-h-11 items-center gap-2 self-start rounded-m bg-vert-esatic px-4 font-semibold text-sur-vert no-underline">
          <Bell size={18} aria-hidden />
          Activer les notifications
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          retenirRefus(CLE_REFUS_NOTIFICATIONS);
          setVisible(false);
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-encre-douce"
      >
        <X size={20} aria-hidden />
        <span className="sr-only">Plus tard</span>
      </button>
    </aside>
  );
}
