"use client";

import { useRef, useState } from "react";
import type { ReadKind, ReadResult } from "@/lib/vision-types";

/**
 * Prepara la foto para leer: JPEG de hasta 2000 px del lado mayor.
 * Mantiene detalle suficiente para letras chicas (VIN, tarjeta) y pesa menos de 1 MB.
 */
async function toJpeg(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (blob) return blob;
  } catch {}
  return file;
}

export async function readPhoto(kind: ReadKind, file: File): Promise<ReadResult> {
  const image = await toJpeg(file);
  const body = new FormData();
  body.append("kind", kind);
  body.append("image", image, "foto.jpg");
  try {
    const res = await fetch("/api/leer", { method: "POST", body });
    return (await res.json()) as ReadResult;
  } catch {
    return { ok: false, error: "Sin conexión. Probá de nuevo." };
  }
}

/** Botón que abre la cámara, lee la foto y devuelve el resultado. */
export function PhotoButton({
  kind,
  label,
  busyLabel = "Leyendo…",
  onResult,
  className = "btn-secondary text-sm",
  icon,
  ariaLabel,
}: {
  kind: ReadKind;
  label: string;
  busyLabel?: string;
  onResult: (r: ReadResult, preview: string) => void;
  className?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          const preview = URL.createObjectURL(file);
          const result = await readPhoto(kind, file);
          setBusy(false);
          onResult(result, preview);
        }}
      />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={className} aria-label={ariaLabel} aria-busy={busy}>
        {busy ? <Spinner /> : icon}
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

export function Spinner() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

export function ConfidenceNote({ confidence, what }: { confidence: "alta" | "media" | "baja"; what: string }) {
  if (confidence === "alta") {
    return <p className="text-xs font-semibold text-ok">Lectura nítida. Igual confirmá que coincide.</p>;
  }
  return (
    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
      {confidence === "media" ? `Algún carácter de ${what} no se veía del todo claro.` : `La foto no era clara.`} Revisá cada carácter contra el original antes de seguir.
    </p>
  );
}

export const CameraIcon = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

export const CardIcon = (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M6 10h6M6 14h4M15 10h3M15 14h3" />
  </svg>
);
