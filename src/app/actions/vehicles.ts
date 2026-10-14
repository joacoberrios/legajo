"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { appendRecord, createVehicle, findVehicleByPlate, lastOdometer, listRecords } from "@/lib/data";
import { isRecordType } from "@/lib/ledger";
import { isValidPlate, normalizePlate, normalizeVin } from "@/lib/plate";

export type FormValues = {
  type: string;
  odometerKm: string;
  performedOn: string;
  items: string[];
  otherItems: string;
  notes: string;
};

export type ActionState = { error?: string; needsConfirm?: boolean; lastKm?: number; values?: FormValues } | undefined;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Buscador de la pantalla principal: lleva al legajo de la patente. */
export async function searchPlate(form: FormData) {
  await requireUser();
  const plate = normalizePlate(text(form, "plate"));
  if (!isValidPlate(plate)) redirect(`/taller?error=patente&q=${encodeURIComponent(text(form, "plate"))}`);
  redirect(`/taller/auto/${plate}`);
}

export async function createVehicleAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const plate = normalizePlate(text(form, "plate"));
  const vin = normalizeVin(text(form, "vin"));
  const make = text(form, "make");
  const model = text(form, "model");
  const yearRaw = text(form, "year");
  const year = yearRaw ? Number(yearRaw) : null;

  if (!isValidPlate(plate)) return { error: "La patente no es válida." };
  if (vin === "INVALID") return { error: "El VIN debe tener 17 caracteres (sin I, O ni Q)." };
  if (!make || !model) return { error: "Completá marca y modelo." };
  if (year !== null && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1)) {
    return { error: "El año no es válido." };
  }
  if (await findVehicleByPlate(plate)) redirect(`/taller/auto/${plate}`);

  try {
    await createVehicle({ plate, vin, make, model, year, workshopId: user.workshopId });
  } catch (e) {
    if (String(e).includes("vehicles_vin_key")) return { error: "Ese VIN ya está asociado a otra patente." };
    throw e;
  }
  redirect(`/taller/auto/${plate}`);
}

/** Carga de un registro. Si hay error, devuelve lo tipeado para que el formulario no se vacíe. */
export async function createRecordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const result = await createRecord(form);
  if (!result) return result;
  return {
    ...result,
    values: {
      type: text(form, "type"),
      odometerKm: text(form, "odometerKm"),
      performedOn: text(form, "performedOn"),
      items: form.getAll("items").map(String),
      otherItems: text(form, "otherItems"),
      notes: text(form, "notes"),
    },
  };
}

async function createRecord(form: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user.workshopVerified) return { error: "Tu taller todavía no está verificado. Podés consultar legajos, pero no cargar." };

  const plate = normalizePlate(text(form, "plate"));
  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) return { error: "No encontramos el auto." };

  const correctsId = text(form, "correctsId") || null;
  const type = correctsId ? "correction" : text(form, "type");
  if (!isRecordType(type)) return { error: "Elegí el tipo de trabajo." };

  const odometerKm = Number(text(form, "odometerKm").replace(/\D/g, ""));
  if (!Number.isInteger(odometerKm) || odometerKm < 0 || odometerKm > 2_000_000) return { error: "El kilometraje no es válido." };

  const performedOn = text(form, "performedOn");
  const today = new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(performedOn) || performedOn > today || performedOn < "1950-01-01") {
    return { error: "La fecha del trabajo no es válida." };
  }

  const items = [
    ...form.getAll("items").map(String),
    ...text(form, "otherItems").split(",").map((s) => s.trim()),
  ].filter(Boolean);
  const notes = text(form, "notes") || null;
  if (items.length === 0 && !notes) return { error: "Marcá al menos un trabajo o escribí una nota." };

  if (correctsId) {
    const records = await listRecords(vehicle.id);
    const target = records.find((r) => r.id === correctsId);
    if (!target) return { error: "El registro a corregir no es de este auto." };
    if (target.workshopId !== user.workshopId) return { error: "Solo el taller que cargó un registro puede corregirlo." };
    if (!notes) return { error: "Explicá en las notas qué se corrige." };
  } else {
    const lastKm = await lastOdometer(vehicle.id);
    if (lastKm !== null && odometerKm < lastKm && form.get("confirmKm") !== "on") {
      return {
        error: `El kilometraje es menor al último registrado (${lastKm.toLocaleString("es-AR")} km). Revisalo o confirmá que es correcto.`,
        needsConfirm: true,
        lastKm,
      };
    }
  }

  await appendRecord({
    vehicleId: vehicle.id,
    workshopId: user.workshopId,
    userId: user.id,
    type,
    odometerKm,
    performedOn,
    items,
    notes,
    correctsId,
  });
  redirect(`/taller/auto/${plate}?cargado=1`);
}
