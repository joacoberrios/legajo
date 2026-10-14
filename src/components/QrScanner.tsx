"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Lee el QR del parabrisas con la API BarcodeDetector del navegador (Chrome en Android, entre otros).
 * El QR contiene el link del informe (/i/<slug>); desde la app del taller abre el legajo completo.
 */
export function QrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (!Ctor) {
      setMessage("Este navegador no lee QR. Abrí el QR con la cámara del celular o tipeá la patente.");
      setOpen(false);
      return;
    }
    let stream: MediaStream | null = null;
    let stopped = false;
    const detector = new Ctor({ formats: ["qr_code"] });

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        while (!stopped) {
          const codes = await detector.detect(video).catch(() => []);
          const value = codes[0]?.rawValue;
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
      <div className="relative flex h-64 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl bg-ink">
        {open ? (
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
        ) : (
          <>
            <div className="relative h-28 w-56">
              <span className="absolute top-0 left-0 h-7 w-7 rounded-tl-md border-t-[3px] border-l-[3px] border-accent" />
              <span className="absolute top-0 right-0 h-7 w-7 rounded-tr-md border-t-[3px] border-r-[3px] border-accent" />
              <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-md border-b-[3px] border-l-[3px] border-accent" />
              <span className="absolute right-0 bottom-0 h-7 w-7 rounded-br-md border-r-[3px] border-b-[3px] border-accent" />
              <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute inset-0 m-auto h-12 w-12" fill="none" stroke="#E7E5DF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" />
              </svg>
            </div>
            <p className="max-w-60 text-center text-sm text-[#E7E5DF]">Escaneá el QR del parabrisas o buscá por patente</p>
          </>
        )}
        {open && <span className="absolute inset-x-10 top-1/2 h-0.5 bg-accent/80" aria-hidden="true" />}
      </div>
      <button type="button" onClick={() => { setMessage(null); setOpen((o) => !o); }} className="btn-primary">
        {open ? "Cancelar" : "Escanear QR"}
      </button>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </div>
  );
}
