"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plate } from "@/components/Plate";
import { CameraIcon, CardIcon, ConfidenceNote, PhotoButton } from "@/components/PhotoRead";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { encodePrefill, type CardRead, type PlateRead, type ReadResult } from "@/lib/vision-types";

/**
 * Inicio del taller: identificar el auto sacando una foto a la patente o a la tarjeta verde.
 * Siempre termina en una pantalla de confirmación: nada se usa sin que el taller lo vea.
 */
export function VehicleScan() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [plateRead, setPlateRead] = useState<PlateRead | null>(null);
  const [cardRead, setCardRead] = useState<CardRead | null>(null);
  const [plate, setPlate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPlateRead(null);
    setCardRead(null);
    setPlate("");
    setError(null);
  };

  function handle(r: ReadResult, photo: string) {
    reset();
    setPreview(photo);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.kind === "plate") {
      setPlateRead(r);
      setPlate(r.plate);
    } else if (r.kind === "card") {
      setCardRead(r);
      setPlate(r.plate);
    }
  }

  const normalized = normalizePlate(plate);
  const valid = isValidPlate(normalized);

  function go() {
    if (!valid) return;
    const prefill = cardRead
      ? encodePrefill({
          make: cardRead.make,
          model: cardRead.model,
          bodyType: cardRead.bodyType,
          year: cardRead.year,
          vin: cardRead.vin,
          engineNumber: cardRead.engineNumber,
        })
      : null;
    router.push(`/taller/auto/${normalized}${prefill ? `?tv=${prefill}` : ""}`);
  }

  const reading = plateRead || cardRead;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <PhotoButton kind="plate" label="Foto a la patente" busyLabel="Leyendo patente…" onResult={handle} icon={CameraIcon} className="btn-primary text-sm" />
        <PhotoButton kind="card" label="Foto a la tarjeta verde" busyLabel="Leyendo tarjeta…" onResult={handle} icon={CardIcon} className="btn-secondary text-sm" />
      </div>

      {error && (
        <div role="alert" className="space-y-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">
          <p>{error}</p>
          <p className="text-xs">Consejo: de frente, sin reflejos, que la patente ocupe buena parte de la foto.</p>
        </div>
      )}

      {reading && (
        <div className="card space-y-3.5 px-4 py-4">
          <div className="flex items-start gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Foto leída" className="h-20 w-28 shrink-0 rounded-lg border border-line object-cover" />
            )}
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-semibold text-muted uppercase">{cardRead ? "Tarjeta verde" : "Patente leída"}</p>
              {valid ? <Plate plate={normalized} size="lg" /> : <p className="text-sm text-red-700">Patente sin formato válido</p>}
            </div>
          </div>

          <ConfidenceNote confidence={reading.confidence} what="la patente" />

          {plateRead && plateRead.alternatives.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">¿O es alguna de estas?</p>
              <div className="flex flex-wrap gap-2">
                {plateRead.alternatives.map((alt) => (
                  <button key={alt} type="button" onClick={() => setPlate(alt)} className="rounded-lg border border-line bg-white px-1 py-1">
                    <Plate plate={alt} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {cardRead && (
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-paper px-3 py-2.5 text-xs">
              <Field label="Marca" value={cardRead.make} />
              <Field label="Modelo" value={cardRead.model} />
              <Field label="Tipo" value={cardRead.bodyType} />
              <Field label="Año" value={cardRead.year} />
              <Field label="Chasis (VIN)" value={cardRead.vin} mono wide />
              <Field label="Motor" value={cardRead.engineNumber} mono wide />
            </dl>
          )}
          {cardRead?.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-900">{w}</p>
          ))}

          <div>
            <label htmlFor="plateFix" className="label">Corregí la patente si hace falta</label>
            <input
              id="plateFix"
              value={plate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlate(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              className="field font-mono text-lg font-semibold tracking-wider uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={reset} className="btn-secondary text-sm">Cancelar</button>
            <button type="button" onClick={go} disabled={!valid} className="btn-primary text-sm">Es correcta, seguir</button>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, value, mono, wide }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-muted">{label}</dt>
      <dd className={`font-semibold ${mono ? "font-mono" : ""} ${value ? "" : "text-muted"}`}>{value || "no se leyó"}</dd>
    </div>
  );
}
