"use client";

import { useActionState, useState } from "react";
import { completeVehicleAction, createVehicleAction } from "@/app/actions/vehicles";
import { CameraIcon, CardIcon, ConfidenceNote, PhotoButton } from "@/components/PhotoRead";
import { cleanVin, formatPlate } from "@/lib/plate";
import { samePlateLoose } from "@/lib/ocr-parse";
import type { CardRead, Confidence, ReadResult, VehiclePrefill } from "@/lib/vision-types";

type Fields = { make: string; model: string; year: string; bodyType: string; vin: string; engineNumber: string };

function useVehicleFields(initial: VehiclePrefill | null, plate: string) {
  const [f, setF] = useState<Fields>({
    make: initial?.make ?? "",
    model: initial?.model ?? "",
    year: initial?.year ?? "",
    bodyType: initial?.bodyType ?? "",
    vin: initial?.vin ?? "",
    engineNumber: initial?.engineNumber ?? "",
  });
  const [note, setNote] = useState<{ kind: "ok" | "warn" | "error"; text: string; confidence?: Confidence } | null>(
    initial ? { kind: "ok", text: "Datos tomados de la tarjeta verde. Revisalos antes de guardar." } : null,
  );
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  // Tarjeta leída cuya patente no coincide: se guarda por si el taller confirma que es la misma.
  const [pendingCard, setPendingCard] = useState<CardRead | null>(null);

  function applyCard(r: CardRead) {
    setPendingCard(null);
    setF((p) => ({
      make: r.make || p.make,
      model: r.model || p.model,
      year: r.year || p.year,
      bodyType: r.bodyType || p.bodyType,
      vin: r.vin || p.vin,
      engineNumber: r.engineNumber || p.engineNumber,
    }));
    setNote({
      kind: r.warnings.length ? "warn" : "ok",
      text: r.warnings.length ? r.warnings.join(" ") : "Datos tomados de la tarjeta verde. Revisalos antes de guardar.",
      confidence: r.confidence,
    });
  }

  function fromCard(r: ReadResult) {
    setPendingCard(null);
    if (!r.ok) return setNote({ kind: "error", text: r.error });
    if (r.kind !== "card") return;
    if (r.plate && !samePlateLoose(r.plate, plate)) {
      setPendingCard(r);
      return setNote({ kind: "error", text: `En la tarjeta leímos la patente ${formatPlate(r.plate)}, y este auto es ${formatPlate(plate)}.` });
    }
    applyCard(r);
  }

  function fromVin(r: ReadResult) {
    if (!r.ok) return setNote({ kind: "error", text: r.error });
    if (r.kind !== "vin") return;
    setF((p) => ({ ...p, vin: r.vin }));
    setNote({ kind: "ok", text: `Chasis leído: ${r.vin}. Comparalo con el original.`, confidence: r.confidence });
  }

  const confirmCard = pendingCard ? () => applyCard(pendingCard) : null;
  return { f, set, note, fromCard, fromVin, confirmCard };
}

function Note({ note, onConfirm }: { note: ReturnType<typeof useVehicleFields>["note"]; onConfirm?: (() => void) | null }) {
  if (!note) return null;
  if (note.kind === "error")
    return (
      <div role="alert" className="space-y-2.5 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
        <p>{note.text}</p>
        {onConfirm && (
          <button type="button" onClick={onConfirm} className="btn-secondary w-full text-sm">
            Es la misma patente, usar los datos
          </button>
        )}
      </div>
    );
  return (
    <div className="space-y-1.5">
      <p className={`rounded-xl px-3.5 py-3 text-sm ${note.kind === "warn" ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}>{note.text}</p>
      {note.confidence && note.confidence !== "alta" && <ConfidenceNote confidence={note.confidence} what="los códigos" />}
    </div>
  );
}

function VinField({ value, onChange, onPhoto }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; onPhoto: (r: ReadResult) => void }) {
  const clean = value.trim() ? cleanVin(value) : null;
  const typed = value.replace(/[^A-Za-z0-9]/g, "").length;
  return (
    <div>
      <label htmlFor="vin" className="label">Número de chasis (VIN)</label>
      <div className="flex gap-2">
        <input
          id="vin"
          name="vin"
          value={value}
          onChange={onChange}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="17 caracteres"
          className="field font-mono uppercase"
        />
        <PhotoButton
          kind="vin"
          label=""
          busyLabel=""
          onResult={onPhoto}
          icon={CameraIcon}
          ariaLabel="Leer el chasis con la cámara"
          className="flex h-[52px] w-14 shrink-0 items-center justify-center rounded-xl border border-line bg-white"
        />
      </div>
      <p className={`mt-1 text-xs ${value && !clean ? "text-red-700" : "text-muted"}`}>
        {!value ? "Tipealo o tocá la cámara para leerlo de la chapita del parabrisas, la puerta o el chasis." : clean ? `${clean} · 17 caracteres` : `${typed} de 17 caracteres (no lleva I, O ni Q)`}
      </p>
    </div>
  );
}

/** Alta del auto: a mano, con la tarjeta verde o con foto del chasis. */
export function VehicleForm({ plate, prefill, sticker }: { plate: string; prefill: VehiclePrefill | null; sticker?: string | null }) {
  const [state, action, pending] = useActionState(createVehicleAction, undefined);
  const { f, set, note, fromCard, fromVin, confirmCard } = useVehicleFields(prefill, plate);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="plate" value={plate} />
      {sticker && <input type="hidden" name="sticker" value={sticker} />}
      <PhotoButton kind="card" label="Completar con foto de la tarjeta verde" busyLabel="Leyendo tarjeta verde…" onResult={fromCard} icon={CardIcon} className="btn-primary text-sm" />
      <Note note={note} onConfirm={confirmCard} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="make" className="label">Marca</label>
          <input id="make" name="make" value={f.make} onChange={set("make")} placeholder="Toyota" required className="field" />
        </div>
        <div>
          <label htmlFor="model" className="label">Modelo</label>
          <input id="model" name="model" value={f.model} onChange={set("model")} placeholder="Hilux 2.8 SRX" required className="field" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="year" className="label">Año</label>
          <input id="year" name="year" value={f.year} onChange={set("year")} inputMode="numeric" placeholder="2021" className="field font-mono" />
        </div>
        <div>
          <label htmlFor="bodyType" className="label">Tipo</label>
          <input id="bodyType" name="bodyType" value={f.bodyType} onChange={set("bodyType")} placeholder="Pick-up" className="field" />
        </div>
      </div>
      <VinField value={f.vin} onChange={set("vin")} onPhoto={fromVin} />
      <div>
        <label htmlFor="engineNumber" className="label">Número de motor (opcional)</label>
        <input id="engineNumber" name="engineNumber" value={f.engineNumber} onChange={set("engineNumber")} autoCapitalize="characters" autoComplete="off" className="field font-mono uppercase" />
      </div>

      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando…" : "Crear legajo"}
      </button>
    </form>
  );
}

/** Para autos que ya tienen legajo pero no tienen chasis o motor: se cargan una sola vez. */
export function CompleteVehicleForm({
  plate,
  missingVin,
  missingEngine,
  prefill,
}: {
  plate: string;
  missingVin: boolean;
  missingEngine: boolean;
  prefill: VehiclePrefill | null;
}) {
  const [state, action, pending] = useActionState(completeVehicleAction, undefined);
  const { f, set, note, fromCard, fromVin, confirmCard } = useVehicleFields(prefill, plate);

  return (
    <form action={action} className="card space-y-3.5 px-4 py-4">
      <input type="hidden" name="plate" value={plate} />
      <div>
        <p className="text-sm font-semibold">Faltan datos del vehículo</p>
        <p className="text-xs text-muted">El número de chasis identifica al auto aunque cambie de patente. Se carga una sola vez.</p>
      </div>
      <PhotoButton kind="card" label="Leer de la tarjeta verde" busyLabel="Leyendo tarjeta verde…" onResult={fromCard} icon={CardIcon} className="btn-secondary text-sm" />
      <Note note={note} onConfirm={confirmCard} />
      {missingVin && <VinField value={f.vin} onChange={set("vin")} onPhoto={fromVin} />}
      {missingEngine && (
        <div>
          <label htmlFor="engineNumber" className="label">Número de motor (opcional)</label>
          <input id="engineNumber" name="engineNumber" value={f.engineNumber} onChange={set("engineNumber")} autoCapitalize="characters" autoComplete="off" className="field font-mono uppercase" />
        </div>
      )}
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary text-sm">
        {pending ? "Guardando…" : "Guardar datos del vehículo"}
      </button>
    </form>
  );
}
