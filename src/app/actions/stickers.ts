"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth";
import { findVehicleByPlate } from "@/lib/data";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { normalizeStickerCode } from "@/lib/sticker-code";
import { assignSticker, createBatch, voidSticker, type AssignResult } from "@/lib/stickers";

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Desde /q/<código>: el mecánico dice a qué patente se lo pegó. Si el auto no existe, se da de alta y se asigna al guardar. */
export async function assignStickerByPlate(form: FormData) {
  const user = await requireUser();
  const code = normalizeStickerCode(text(form, "code"));
  if (!code) redirect("/taller");
  const plate = normalizePlate(text(form, "plate"));
  if (!isValidPlate(plate)) redirect(`/q/${code}?error=patente`);

  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) redirect(`/taller/auto/${plate}?sticker=${code}`);
  // Es definitivo: primero se muestra el auto y se pide confirmar.
  if (text(form, "confirm") !== "1") redirect(`/q/${code}?confirmar=${plate}`);

  const r = await assignSticker(code, vehicle, user);
  if (!r.ok) redirect(`/q/${code}?error=${encodeURIComponent(r.error)}`);
  redirect(`/taller/auto/${plate}?vinculado=1`);
}

/** Desde el legajo de un auto: escanear un sticker libre y vincularlo. */
export async function linkStickerToVehicle(rawCode: string, rawPlate: string): Promise<AssignResult> {
  const user = await requireUser();
  const code = normalizeStickerCode(rawCode);
  if (!code) return { ok: false, error: "Ese no es un código de sticker de Legajo." };
  const vehicle = await findVehicleByPlate(normalizePlate(rawPlate));
  if (!vehicle) return { ok: false, error: "No encontramos el auto." };
  const r = await assignSticker(code, vehicle, user);
  if (r.ok) revalidatePath(`/taller/auto/${vehicle.plate}`);
  return r;
}

export async function createBatchAction(form: FormData) {
  const user = await requireAdmin();
  const quantity = Math.floor(Number(text(form, "quantity")));
  const label = text(form, "label").slice(0, 80) || "Tanda sin nombre";
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 600) redirect("/admin/stickers?error=cantidad");
  const id = await createBatch(label, quantity, user.id);
  redirect(`/admin/stickers/${id}`);
}

export async function voidStickerAction(form: FormData) {
  await requireAdmin();
  const code = normalizeStickerCode(text(form, "code"));
  const ok = code ? await voidSticker(code) : false;
  redirect(`/admin/stickers?${ok ? "anulado" : "error"}=${code ?? "codigo"}`);
}
