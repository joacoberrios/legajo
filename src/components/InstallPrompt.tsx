"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const KEY = "legajo:install-dismissed";

/**
 * Invita a instalar Legajo en el celular.
 * Android/Chrome: botón que abre el diálogo nativo. iPhone/Safari: cómo agregarla a la pantalla de inicio.
 * No aparece si ya está instalada o si el usuario la cerró.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (dismissed || standalone) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) {
      setIos(true);
      setHidden(false);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!event && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setHidden(true);
  };

  return (
    <div className="card flex items-start gap-3 px-4 py-3.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-semibold">Instalá Legajo en el celular</p>
        {event ? (
          <p className="text-xs text-muted">Abrila desde la pantalla de inicio, como cualquier app.</p>
        ) : (
          <p className="text-xs text-muted">
            En Safari tocá <strong>Compartir</strong> y después <strong>Agregar a inicio</strong>.
          </p>
        )}
        <div className="flex gap-2">
          {event && (
            <button
              type="button"
              onClick={async () => {
                await event.prompt();
                await event.userChoice.catch(() => null);
                setEvent(null);
                setHidden(true);
              }}
              className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
            >
              Instalar
            </button>
          )}
          <button type="button" onClick={dismiss} className="h-10 rounded-xl px-3 text-sm font-semibold text-muted">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
