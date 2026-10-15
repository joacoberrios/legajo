"use client";

import { useRef } from "react";
import { uploadPresigned } from "@vercel/blob/client";
import { ATTACHMENT_LABELS, ATTACHMENT_LIMITS, type AttachmentKind } from "@/lib/records-meta";

export type PickedFile = {
  key: string;
  kind: AttachmentKind;
  name: string;
  preview: string | null; // URL local para la miniatura
  status: "uploading" | "done" | "error";
  progress: number;
  url?: string;
  error?: string;
};

const SLOTS: { kind: AttachmentKind; hint: string; accept: string; capture?: "environment"; multiple: boolean }[] = [
  { kind: "odometer", hint: "Que se lea el km", accept: "image/*", capture: "environment", multiple: false },
  { kind: "work", hint: "Piezas, antes y después", accept: "image/*", multiple: true },
  { kind: "document", hint: "Factura u orden (foto o PDF)", accept: "image/*,application/pdf", multiple: true },
];

/** Achica fotos grandes del celular antes de subirlas (máx. 1920 px, JPEG). PDF y HEIC pasan tal cual. */
async function prepare(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function AttachmentPicker({
  files,
  setFiles,
  workshopId,
  plate,
  access,
}: {
  files: PickedFile[];
  setFiles: (update: (prev: PickedFile[]) => PickedFile[]) => void;
  workshopId: string;
  plate: string;
  access: "public" | "private";
}) {
  const inputs = useRef<Partial<Record<AttachmentKind, HTMLInputElement | null>>>({});

  const patch = (key: string, data: Partial<PickedFile>) =>
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...data } : f)));

  async function add(kind: AttachmentKind, list: FileList | null) {
    if (!list?.length) return;
    const room = ATTACHMENT_LIMITS.maxFiles - files.length;
    const chosen = Array.from(list).slice(0, Math.max(0, room));
    for (const original of chosen) {
      const key = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const isImage = original.type.startsWith("image/") && !/hei[cf]/.test(original.type);
      setFiles((prev) => [
        ...prev,
        { key, kind, name: original.name, preview: isImage ? URL.createObjectURL(original) : null, status: "uploading", progress: 0 },
      ]);
      try {
        const file = await prepare(original);
        if (file.size > ATTACHMENT_LIMITS.maxBytes) throw new Error("El archivo pesa más de 10 MB.");
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
        const blob = await uploadPresigned(`adjuntos/${workshopId}/${plate}/${kind}.${ext}`, file, {
          access,
          handleUploadUrl: "/api/adjuntos",
        });
        patch(key, { status: "done", progress: 100, url: blob.url });
      } catch (e) {
        patch(key, { status: "error", error: e instanceof Error ? e.message : "No se pudo subir." });
      }
    }
    const input = inputs.current[kind];
    if (input) input.value = "";
  }

  function remove(key: string) {
    setFiles((prev) => {
      const f = prev.find((x) => x.key === key);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.key !== key);
    });
  }

  const full = files.length >= ATTACHMENT_LIMITS.maxFiles;

  return (
    <fieldset className="space-y-3">
      <legend className="label">Respaldo</legend>
      <p className="-mt-1 text-xs text-muted">
        La foto del tablero o un comprobante marcan el registro como respaldado en el informe. Quedan sellados con la firma.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map((s) => (
          <label
            key={s.kind}
            className={`card flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 px-2 py-3 text-center ${full ? "pointer-events-none opacity-50" : "hover:border-ink"}`}
          >
            <input
              ref={(el: HTMLInputElement | null) => {
                inputs.current[s.kind] = el;
              }}
              type="file"
              accept={s.accept}
              capture={s.capture}
              multiple={s.multiple}
              disabled={full}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => add(s.kind, e.target.files)}
              className="sr-only"
            />
            <SlotIcon kind={s.kind} />
            <span className="text-xs font-semibold leading-tight">{ATTACHMENT_LABELS[s.kind]}</span>
            <span className="text-[11px] leading-tight text-muted">{s.hint}</span>
          </label>
        ))}
      </div>

      {files.length > 0 && (
        <ul className="grid grid-cols-4 gap-2">
          {files.map((f) => (
            <li key={f.key} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-line bg-white">
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.preview} alt={ATTACHMENT_LABELS[f.kind]} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-xs font-semibold text-muted">
                    {f.name.toLowerCase().endsWith(".pdf") ? "PDF" : "Archivo"}
                  </div>
                )}
                {f.status === "uploading" && (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
                    <div className="h-full w-full animate-pulse bg-accent" />
                  </div>
                )}
                {f.status === "error" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 px-1 text-center text-[10px] font-semibold text-white">
                    No se subió
                  </div>
                )}
              </div>
              <span className="mt-1 block truncate text-[10px] text-muted">{ATTACHMENT_LABELS[f.kind]}</span>
              <button
                type="button"
                onClick={() => remove(f.key)}
                aria-label={`Quitar ${ATTACHMENT_LABELS[f.kind]}`}
                className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white shadow-sm"
              >
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.some((f) => f.status === "error") && (
        <p className="text-xs text-red-700">
          {files.find((f) => f.status === "error")?.error} Quitalo y volvé a intentar.
        </p>
      )}
    </fieldset>
  );
}

function SlotIcon({ kind }: { kind: AttachmentKind }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "odometer")
    return (
      <svg {...common}><path d="M12 14l4-4" /><path d="M3.3 17a9 9 0 1 1 17.4 0" /><path d="M7 17h10" /></svg>
    );
  if (kind === "work")
    return (
      <svg {...common}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3.5" /></svg>
    );
  return (
    <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>
  );
}
