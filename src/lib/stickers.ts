import "server-only";
import { db } from "./db";
import { randomStickerCode } from "./sticker-code";
import type { SessionUser } from "./auth";

export type Sticker = {
  code: string;
  batchId: string;
  vehicleId: string | null;
  assignedAt: Date | null;
  voidedAt: Date | null;
  plate: string | null;
  publicSlug: string | null;
};

export async function findSticker(code: string): Promise<Sticker | null> {
  const rows = await db()<Sticker[]>`
    SELECT s.code, s.batch_id, s.vehicle_id, s.assigned_at, s.voided_at, v.plate, v.public_slug
    FROM stickers s LEFT JOIN vehicles v ON v.id = s.vehicle_id
    WHERE s.code = ${code}
  `;
  return rows[0] ?? null;
}

export type AssignResult = { ok: true; plate: string } | { ok: false; error: string };

/** Asigna un sticker libre a un auto. Es definitivo: si ya tiene auto, no se cambia. */
export async function assignSticker(code: string, vehicle: { id: string; plate: string }, user: SessionUser): Promise<AssignResult> {
  if (!user.workshopVerified) return { ok: false, error: "Podés asignar stickers cuando verifiquemos tu taller." };
  const sql = db();
  const updated = await sql<{ code: string }[]>`
    UPDATE stickers
    SET vehicle_id = ${vehicle.id}, assigned_at = now(), assigned_by = ${user.id}, assigned_workshop_id = ${user.workshopId}
    WHERE code = ${code} AND vehicle_id IS NULL AND voided_at IS NULL
    RETURNING code
  `;
  if (updated.length) return { ok: true, plate: vehicle.plate };

  const s = await findSticker(code);
  if (!s) return { ok: false, error: "Ese código no es de un sticker de Legajo." };
  if (s.voidedAt) return { ok: false, error: "Ese sticker está anulado. Usá otro." };
  if (s.vehicleId === vehicle.id) return { ok: true, plate: vehicle.plate };
  return { ok: false, error: `Ese sticker ya está asignado a otro auto (${s.plate}). Despegalo y usá uno nuevo.` };
}

export type Batch = { id: string; label: string; quantity: number; createdAt: Date; assigned: number; voided: number };

export async function listBatches(): Promise<Batch[]> {
  return db()<Batch[]>`
    SELECT b.id, b.label, b.quantity, b.created_at,
      count(s.vehicle_id)::int AS assigned,
      count(s.voided_at)::int AS voided
    FROM sticker_batches b JOIN stickers s ON s.batch_id = b.id
    GROUP BY b.id ORDER BY b.created_at DESC
  `;
}

/** Crea una tanda de stickers con códigos únicos al azar. */
export async function createBatch(label: string, quantity: number, userId: string): Promise<string> {
  const sql = db();
  return sql.begin(async (tx) => {
    const [batch] = await tx<{ id: string }[]>`
      INSERT INTO sticker_batches (label, quantity, created_by) VALUES (${label}, ${quantity}, ${userId}) RETURNING id
    `;
    let made = 0;
    while (made < quantity) {
      const codes = Array.from({ length: quantity - made }, () => ({ code: randomStickerCode(), batch_id: batch.id }));
      const inserted = await tx`INSERT INTO stickers ${tx(codes, "code", "batch_id")} ON CONFLICT (code) DO NOTHING RETURNING code`;
      made += inserted.length;
    }
    return batch.id;
  });
}

export async function batchCodes(batchId: string): Promise<{ label: string; codes: { code: string; assigned: boolean }[] } | null> {
  const sql = db();
  const [batch] = await sql<{ label: string }[]>`SELECT label FROM sticker_batches WHERE id = ${batchId}`;
  if (!batch) return null;
  const codes = await sql<{ code: string; assigned: boolean }[]>`
    SELECT code, vehicle_id IS NOT NULL AS assigned FROM stickers WHERE batch_id = ${batchId} ORDER BY created_at, code
  `;
  return { label: batch.label, codes };
}

export async function voidSticker(code: string): Promise<boolean> {
  const rows = await db()`UPDATE stickers SET voided_at = now() WHERE code = ${code} AND voided_at IS NULL RETURNING code`;
  return rows.length > 0;
}

export async function vehicleStickers(vehicleId: string): Promise<{ code: string; voidedAt: Date | null }[]> {
  return db()<{ code: string; voidedAt: Date | null }[]>`
    SELECT code, voided_at FROM stickers WHERE vehicle_id = ${vehicleId} ORDER BY assigned_at
  `;
}
