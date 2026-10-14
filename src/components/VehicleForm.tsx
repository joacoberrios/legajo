"use client";

import { useActionState } from "react";
import { createVehicleAction } from "@/app/actions/vehicles";

export function VehicleForm({ plate }: { plate: string }) {
  const [state, action, pending] = useActionState(createVehicleAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="plate" value={plate} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="make" className="label">Marca</label>
          <input id="make" name="make" placeholder="Toyota" required className="field" />
        </div>
        <div>
          <label htmlFor="model" className="label">Modelo</label>
          <input id="model" name="model" placeholder="Hilux 2.8 SRX" required className="field" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="year" className="label">Año</label>
          <input id="year" name="year" inputMode="numeric" placeholder="2021" className="field font-mono" />
        </div>
        <div>
          <label htmlFor="vin" className="label">VIN (opcional)</label>
          <input id="vin" name="vin" autoCapitalize="characters" placeholder="17 caracteres" className="field font-mono uppercase" />
        </div>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creando…" : "Crear legajo"}
      </button>
    </form>
  );
}
