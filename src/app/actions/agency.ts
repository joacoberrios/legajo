"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAgency } from "@/lib/auth";
import { isStage, setFollow, unfollow } from "@/lib/agency";
import { issueAgencyReport } from "@/lib/billing";
import { findVehicleByPlate, listRecords } from "@/lib/data";
import { normalizePlate } from "@/lib/plate";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function vehicleFrom(form: FormData) {
  const plate = normalizePlate(text(form, "plate"));
  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) redirect("/agencia");
  return vehicle;
}

/** Seguir un auto (o moverlo de etapa: evaluando → en stock → vendido). */
export async function setStageAction(form: FormData) {
  const user = await requireAgency();
  const vehicle = await vehicleFrom(form);
  const stage = text(form, "stage");
  if (!isStage(stage)) return;
  const records = await listRecords(vehicle.id);
  await setFollow(user, vehicle.id, stage, records.length);
  revalidatePath(`/agencia/auto/${vehicle.plate}`);
  revalidatePath("/agencia");
  revalidatePath(`/panel/vehiculos/${vehicle.plate}`);
  revalidatePath("/panel/vehiculos");
}

export async function unfollowAction(form: FormData) {
  const user = await requireAgency();
  const vehicle = await vehicleFrom(form);
  await unfollow(user.workshopId, vehicle.id);
  revalidatePath(`/agencia/auto/${vehicle.plate}`);
  revalidatePath("/agencia");
  revalidatePath(`/panel/vehiculos/${vehicle.plate}`);
  revalidatePath("/panel/vehiculos");
}

/** Emite el informe verificado y lo abre para compartirlo o imprimirlo. */
export async function issueReportAction(form: FormData) {
  const user = await requireAgency();
  const vehicle = await vehicleFrom(form);
  const back = text(form, "base") === "panel" ? `/panel/vehiculos/${vehicle.plate}` : `/agencia/auto/${vehicle.plate}`;
  if (!user.workshopVerified) redirect(`${back}?error=verificacion`);
  const r = await issueAgencyReport(user, vehicle.id);
  if ("error" in r) redirect(`${back}?error=${r.error}`);
  const code = r.code;
  redirect(`/v/${code}?nuevo=1`);
}
