"use client";

import { useEffect, useRef, useState } from "react";
import { Plate } from "@/components/Plate";
import { crop, getWorker, preprocess, readPlateCanvas } from "@/lib/ocr-client";
import type { PlateRead } from "@/lib/vision-types";

const ASPECT = 3.1; // patente Mercosur: 400 × 130 mm
const WINDOW = 6; // últimas lecturas que se comparan
const NEEDED = 3; // coincidencias necesarias para aceptar

/**
 * Escáner de patente en vivo, gratis y en el celular.
 * Lee cuadro por cuadro el recorte del marco, alternando blanco/negro e invertido (patentes viejas negras),
 * corrige letras/números según el formato argentino y solo acepta cuando varias lecturas coinciden.
 */
export function PlateScanner({ onDetected, onCancel }: { onDetected: (r: PlateRead) => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<"starting" | "loading" | "scanning" | "error">("starting");
  const [guess, setGuess] = useState<{ plate: string; votes: number } | null>(null);
  const [hint, setHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const track = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let running = true;
    const history: string[] = [];
    const hintTimer = setTimeout(() => setHint(true), 12_000);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const v = video.current;
        if (!v || !running) return;
        v.srcObject = stream;
        await v.play();
        const t = stream.getVideoTracks()[0];
        track.current = t;
        try {
          await t.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
        } catch {}
        const caps = (t.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
        if (caps.torch) setTorch({ supported: true, on: false });

        setPhase("loading");
        await getWorker("eng"); // descarga el motor la primera vez
        if (!running) return;
        setPhase("scanning");

        let frame = 0;
        while (running) {
          const c = box.current;
          if (!c || !v.videoWidth) {
            await sleep(200);
            continue;
          }
          // Recorte del video que corresponde al marco visible (el video se muestra con object-cover).
          const cw = c.clientWidth;
          const ch = c.clientHeight;
          const scale = Math.max(cw / v.videoWidth, ch / v.videoHeight);
          const offX = (cw - v.videoWidth * scale) / 2;
          const offY = (ch - v.videoHeight * scale) / 2;
          const gw = cw * 0.84;
          const gh = gw / ASPECT;
          const gx = (cw - gw) / 2;
          const gy = (ch - gh) / 2;
          const m = 0.06; // margen para no cortar bordes
          const sx = (gx - gw * m - offX) / scale;
          const sy = (gy - gh * m - offY) / scale;
          const sw = (gw * (1 + 2 * m)) / scale;
          const sh = (gh * (1 + 2 * m)) / scale;

          const canvas = preprocess(crop(v, Math.max(0, sx), Math.max(0, sy), sw, sh, 720), {
            binarize: frame % 3 !== 2,
            invert: frame % 3 === 1, // patentes viejas: letras blancas sobre negro
          });
          frame++;

          const { candidates } = await readPlateCanvas(canvas);
          const top = candidates.find((x) => x.fixes <= 2);
          if (top) {
            history.push(top.plate);
            if (history.length > WINDOW) history.shift();
            const votes = history.filter((p) => p === top.plate).length;
            setGuess({ plate: top.plate, votes });
            if (votes >= NEEDED) {
              running = false;
              const others = [...new Set(history.filter((p) => p !== top.plate))];
              onDetected({
                ok: true,
                kind: "plate",
                plate: top.plate,
                confidence: votes >= NEEDED + 1 && top.fixes === 0 ? "alta" : "media",
                alternatives: others.slice(0, 3),
              });
              break;
            }
          }
          await sleep(120);
        }
      } catch (e) {
        setPhase("error");
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError"
            ? "Bloqueaste el permiso de la cámara. Habilitalo en la configuración del navegador o tipeá la patente."
            : "No pudimos abrir la cámara o el lector. Tipeá la patente.",
        );
      }
    })();

    return () => {
      running = false;
      clearTimeout(hintTimer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleTorch() {
    const t = track.current;
    if (!t) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((s) => ({ ...s, on: !s.on }));
    } catch {}
  }

  return (
    <div className="space-y-3">
      <div ref={box} className="relative h-72 overflow-hidden rounded-3xl bg-ink">
        <video ref={video} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
        {/* Marco de la patente */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-[84%] rounded-lg shadow-[0_0_0_9999px_rgba(21,23,26,0.55)]" style={{ aspectRatio: String(ASPECT) }}>
            <span className="absolute -top-0.5 -left-0.5 h-6 w-6 rounded-tl-lg border-t-[3px] border-l-[3px] border-accent" />
            <span className="absolute -top-0.5 -right-0.5 h-6 w-6 rounded-tr-lg border-t-[3px] border-r-[3px] border-accent" />
            <span className="absolute -bottom-0.5 -left-0.5 h-6 w-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-accent" />
            <span className="absolute -right-0.5 -bottom-0.5 h-6 w-6 rounded-br-lg border-r-[3px] border-b-[3px] border-accent" />
            {phase === "scanning" && <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-accent/80" />}
          </div>
        </div>
        <p className="absolute inset-x-0 top-3 text-center text-xs font-semibold text-white drop-shadow">
          {phase === "starting" && "Abriendo cámara…"}
          {phase === "loading" && "Preparando el lector (solo la primera vez)…"}
          {phase === "scanning" && "Encuadrá la patente dentro del marco"}
        </p>
        {guess && phase === "scanning" && (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
            <Plate plate={guess.plate} size="sm" />
            <span className="rounded-full bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">
              {Math.min(guess.votes, NEEDED)}/{NEEDED}
            </span>
          </div>
        )}
        {torch.supported && (
          <button type="button" onClick={toggleTorch} aria-label={torch.on ? "Apagar linterna" : "Prender linterna"} className={`absolute top-2 right-2 flex h-11 w-11 items-center justify-center rounded-full ${torch.on ? "bg-accent text-white" : "bg-black/50 text-white"}`}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M8 2h8l-1 6H9zM9 8v12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V8" /></svg>
          </button>
        )}
      </div>
      {hint && phase === "scanning" && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          Acercate hasta que la patente llene el marco, evitá reflejos{torch.supported ? " o prendé la linterna" : ""}. Si no la toma, tipeala abajo.
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{error}</p>}
      <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancelar</button>
    </div>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
