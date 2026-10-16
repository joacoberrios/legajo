"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;
type DetectFn = (video: HTMLVideoElement) => Promise<string | null>;

/**
 * Lector de QR: usa el nativo del navegador (BarcodeDetector) si existe;
 * si no (Safari, Firefox, Chrome de escritorio), decodifica los cuadros del video con jsQR.
 */
async function createDetector(): Promise<DetectFn> {
  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (Ctor) {
    const native = new Ctor({ formats: ["qr_code"] });
    return async (video) => (await native.detect(video))[0]?.rawValue ?? null;
  }
  const jsQR = (await import("jsqr")).default;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    if (!ctx || !video.videoWidth) return null;
    const scale = Math.min(1, 640 / video.videoWidth); // achicar acelera la lectura
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return jsQR(data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
  };
}

/**
 * Lee el QR del parabrisas con la cámara (nativo o jsQR según el navegador).
 * El QR contiene el link del informe (/i/<slug>); desde la app del taller abre el legajo completo.
 */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let stopped = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMessage("Este navegador no permite usar la cámara. Tipeá la patente.");
          setOpen(false);
          return;
        }
        const detect = await createDetector();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const video = videoRef.current;
        if (!video || stopped) {
          stream.getTracks().forEach((t) => t.stop()); // se canceló mientras pedía permiso
          return;
        }
        video.srcObject = stream;
        await video.play();
        while (!stopped) {
          const value = await detect(video).catch(() => null);
          if (value) {
            const slug = value.match(/\/i\/([A-Za-z0-9_-]+)/)?.[1];
            stopped = true;
            if (slug) router.push(`/taller/s/${slug}`);
            else setMessage("Ese QR no es de Legajo.");
            setOpen(false);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setMessage("No pudimos acceder a la cámara. Revisá los permisos del navegador.");
        setOpen(false);
      }
    })();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, router]);

  return (
    <div className="space-y-3">
      {open && (
        <div className="relative h-64 overflow-hidden rounded-3xl bg-ink">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
          <span className="absolute inset-x-10 top-1/2 h-0.5 bg-accent/80" aria-hidden="true" />
        </div>
      )}
      <button type="button" onClick={() => { setMessage(null); setOpen((o) => !o); }} className="btn-secondary text-sm">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
        </svg>
        {open ? "Cancelar" : "Escanear QR del parabrisas"}
      </button>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </div>
  );
}
