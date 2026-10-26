import "server-only";
import { db } from "./db";
import { analyze, type LedgerRecord } from "./ledger";
import { randomStickerCode } from "./sticker-code";
import type { SessionUser } from "./auth";
import type { Vehicle } from "./data";

export const STAGES = ["evaluando", "stock", "vendido"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = { evaluando: "Evaluando", stock: "En stock", vendido: "Vendido" };
export const isStage = (s: string): s is Stage => (STAGES as readonly string[]).includes(s);

export type FollowedVehicle = {
  vehicleId: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  stage: Stage;
  records: number;
  seenRecords: number;
  lastKm: number | null;
  lastRecordAt: Date | null;
  updatedAt: Date;
};

/** Autos que sigue la agencia, con cuántos registros nuevos tienen desde la última vez que los abrió. */
export async function listFollowed(workshopId: string): Promise<FollowedVehicle[]> {
  return db()<FollowedVehicle[]>`
    SELECT v.id AS vehicle_id, v.plate, v.make, v.model, v.year, av.stage, av.seen_records, av.updated_at,
      (SELECT count(*) FROM service_records r WHERE r.vehicle_id = v.id)::int AS records,
      (SELECT r.odometer_km FROM service_records r WHERE r.vehicle_id = v.id ORDER BY r.created_at DESC LIMIT 1) AS last_km,
      (SELECT max(r.created_at) FROM service_records r WHERE r.vehicle_id = v.id) AS last_record_at
    FROM agency_vehicles av JOIN vehicles v ON v.id = av.vehicle_id
    WHERE av.workshop_id = ${workshopId}
    ORDER BY (av.stage = 'vendido'), av.updated_at DESC
  `;
}

export async function findFollow(workshopId: string, vehicleId: string): Promise<{ stage: Stage; seenRecords: number } | null> {
  const rows = await db()<{ stage: Stage; seenRecords: number }[]>`
    SELECT stage, seen_records FROM agency_vehicles WHERE workshop_id = ${workshopId} AND vehicle_id = ${vehicleId}
  `;
  return rows[0] ?? null;
}

/** Seguir un auto o cambiarle la etapa. */
export async function setFollow(user: SessionUser, vehicleId: string, stage: Stage, records: number) {
  await db()`
    INSERT INTO agency_vehicles (workshop_id, vehicle_id, stage, seen_records, added_by)
    VALUES (${user.workshopId}, ${vehicleId}, ${stage}, ${records}, ${user.id})
    ON CONFLICT (workshop_id, vehicle_id) DO UPDATE SET stage = EXCLUDED.stage, updated_at = now()
  `;
}

export async function unfollow(workshopId: string, vehicleId: string) {
  await db()`DELETE FROM agency_vehicles WHERE workshop_id = ${workshopId} AND vehicle_id = ${vehicleId}`;
}

/** Al abrir la ficha, los registros nuevos pasan a vistos. */
export async function markSeen(workshopId: string, vehicleId: string, records: number) {
  await db()`
    UPDATE agency_vehicles SET seen_records = ${records}
    WHERE workshop_id = ${workshopId} AND vehicle_id = ${vehicleId} AND seen_records <> ${records}
  `;
}

export type VerifiedReport = {
  code: string;
  vehicleId: string;
  recordCount: number;
  headHash: string | null;
  score: number | null;
  issuedAt: Date;
  agencyName: string;
  agencyPhone: string | null;
  purchaseStatus: string | null;
};

/**
 * Emite un informe verificado: congela cuántos registros había y el hash del último.
 * `issuer` null = lo emite Legajo (compra de un particular).
 */
export async function issueReport(
  issuer: { workshopId: string; id: string } | null,
  vehicle: Vehicle,
  records: LedgerRecord[],
  purchaseId: string | null = null,
): Promise<string> {
  const a = analyze(records);
  const head = records.at(-1)?.hash ?? null;
  for (let i = 0; i < 5; i++) {
    const code = randomStickerCode();
    const rows = await db()`
      INSERT INTO verified_reports (code, vehicle_id, workshop_id, user_id, record_count, head_hash, score, purchase_id)
      VALUES (${code}, ${vehicle.id}, ${issuer?.workshopId ?? null}, ${issuer?.id ?? null}, ${records.length}, ${head}, ${a.chainOk ? a.score : 0}, ${purchaseId})
      ON CONFLICT (code) DO NOTHING RETURNING code
    `;
    if (rows.length) return code;
  }
  throw new Error("No se pudo generar el código del informe");
}

export async function findReport(code: string): Promise<VerifiedReport | null> {
  const rows = await db()<VerifiedReport[]>`
    SELECT r.code, r.vehicle_id, r.record_count, r.head_hash, r.score, r.issued_at,
      coalesce(w.name, 'Legajo') AS agency_name, w.phone AS agency_phone, p.status AS purchase_status
    FROM verified_reports r LEFT JOIN workshops w ON w.id = r.workshop_id LEFT JOIN purchases p ON p.id = r.purchase_id
    WHERE r.code = ${code}
  `;
  return rows[0] ?? null;
}

export type IssuedReport = { code: string; plate: string; make: string; model: string; issuedAt: Date; score: number | null };

export async function listReports(workshopId: string, limit = 10, all = false): Promise<IssuedReport[]> {
  return db()<IssuedReport[]>`
    SELECT r.code, v.plate, v.make, v.model, r.issued_at, r.score
    FROM verified_reports r JOIN vehicles v ON v.id = r.vehicle_id
    WHERE (${all} OR r.workshop_id = ${workshopId})
    ORDER BY r.issued_at DESC LIMIT ${limit}
  `;
}
