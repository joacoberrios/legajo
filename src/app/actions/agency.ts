"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAgency } from "@/lib/auth";
import { issueReport, isStage, setFollow, unfollow } from "@/lib/agency";
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
}

export async function unfollowAction(form: FormData) {
  const user = await requireAgency();
  const vehicle = await vehicleFrom(form);
  await unfollow(user.workshopId, vehicle.id);
  revalidatePath(`/agencia/auto/${vehicle.plate}`);
  revalidatePath("/agencia");
}

/** Emite el informe verificado y lo abre para compartirlo o imprimirlo. */
export async function issueReportAction(form: FormData) {
  const user = await requireAgency();
  const vehicle = await vehicleFrom(form);
  if (!user.workshopVerified) redirect(`/agencia/auto/${vehicle.plate}?error=verificacion`);
  const code = await issueReport(user, vehicle, await listRecords(vehicle.id));
  redirect(`/v/${code}?nuevo=1`);
}
