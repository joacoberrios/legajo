"use client";

import { useActionState, useState } from "react";
import { createRecordAction } from "@/app/actions/vehicles";
import { AttachmentPicker, type PickedFile } from "@/components/AttachmentPicker";
import { COMMON_ITEMS, RECORD_LABELS, SELECTABLE_TYPES } from "@/lib/records-meta";

export function RecordForm({
  plate,
  lastKm,
  correcting,
  workshopId,
  blobAccess,
}: {
  plate: string;
  lastKm: number | null;
  correcting: { id: string; label: string; km: number; performedOn: string; items: string[] } | null;
  workshopId: string;
  blobAccess: "public" | "private";
}) {
  const [state, action, pending] = useActionState(createRecordAction, undefined);
  // Los adjuntos viven fuera del <form> con key: si hay un error de validación no se pierden.
  const [files, setFiles] = useState<PickedFile[]>([]);
  const uploading = files.some((f) => f.status === "uploading");
  const failed = files.some((f) => f.status === "error");
  const attachmentsJson = JSON.stringify(files.filter((f) => f.status === "done").map((f) => ({ url: f.url, kind: f.kind })));
  const today = new Date().toISOString().slice(0, 10);
  const v = state?.values; // lo tipeado antes de un error

  return (
    <form key={v ? JSON.stringify(v) : "new"} action={action} className="space-y-6">
      <input type="hidden" name="plate" value={plate} />
      {correcting && <input type="hidden" name="correctsId" value={correcting.id} />}

      {correcting ? (
        <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          Estás corrigiendo: <strong>{correcting.label}</strong>. El original queda visible como corregido; este registro lo reemplaza.
        </p>
      ) : (
        <fieldset>
          <legend className="label">Tipo de trabajo</legend>
          <div className="flex flex-wrap gap-2">
            {SELECTABLE_TYPES.map((t, i) => (
              <label key={t} className="cursor-pointer">
                <input type="radio" name="type" value={t} defaultChecked={v ? v.type === t : i === 0} className="peer sr-only" />
                <span className="flex min-h-11 items-center rounded-full border border-line bg-white px-3.5 text-sm font-semibold peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent">
                  {RECORD_LABELS[t]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="odometerKm" className="label">Kilometraje</label>
          <input
            id="odometerKm"
            name="odometerKm"
            inputMode="numeric"
            required
            defaultValue={v?.odometerKm ?? (correcting ? String(correcting.km) : "")}
            placeholder={lastKm !== null ? String(lastKm) : "0"}
            className="field font-mono text-lg font-semibold"
          />
        </div>
        <div>
          <label htmlFor="performedOn" className="label">Fecha</label>
          <input
            id="performedOn"
            name="performedOn"
            type="date"
            required
            max={today}
            defaultValue={v?.performedOn ?? (correcting ? correcting.performedOn : today)}
            className="field"
          />
        </div>
      </div>
      {lastKm !== null && !correcting && (
        <p className="-mt-4 text-xs text-muted">Último registrado: {lastKm.toLocaleString("es-AR")} km</p>
      )}

      <fieldset>
        <legend className="label">Trabajos realizados</legend>
        <div className="card divide-y divide-[#EDEBE5]">
          {COMMON_ITEMS.map((item) => (
            <label key={item} className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 text-sm">
              <input
                type="checkbox"
                name="items"
                value={item}
                defaultChecked={v ? v.items.includes(item) : correcting?.items.includes(item)}
                className="h-5 w-5 accent-[#C2410C]"
              />
              {item}
            </label>
          ))}
        </div>
        <label htmlFor="otherItems" className="mt-3 block text-sm text-muted">Otros trabajos (separados por coma)</label>
        <input id="otherItems" name="otherItems" defaultValue={v?.otherItems} className="field mt-1.5" placeholder="Junta de tapa de cilindros, sensor ABS" />
      </fieldset>

      <div>
        <label htmlFor="notes" className="label">
          {correcting ? "Qué se corrige (obligatorio)" : "Notas internas (no salen en el informe público)"}
        </label>
        <textarea id="notes" name="notes" rows={3} defaultValue={v?.notes} required={!!correcting} className="field" />
      </div>

      <AttachmentPicker files={files} setFiles={setFiles} workshopId={workshopId} plate={plate} access={blobAccess} />
      <input type="hidden" name="attachments" value={attachmentsJson} />

      {state?.error && (
        <div role="alert" className="space-y-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
          <p>{state.error}</p>
          {state.needsConfirm && (
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" name="confirmKm" className="h-5 w-5 accent-[#C2410C]" />
              Confirmo que el kilometraje es correcto
            </label>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 space-y-2 border-t border-line bg-paper px-5 pt-3 pb-6">
        <p className="text-center text-xs text-muted">Queda firmado por tu taller y no se puede editar, solo corregir.</p>
        <button type="submit" disabled={pending || uploading || failed} className="btn-primary">
          {pending ? "Verificando y firmando…" : uploading ? "Subiendo archivos…" : failed ? "Quitá el archivo con error" : "Firmar y publicar"}
        </button>
      </div>
    </form>
  );
}
