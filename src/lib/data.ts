import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { computeHash, type AttachmentKind, type LedgerRecord, type RecordType } from "./ledger";

export type Vehicle = {
  id: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  bodyType: string | null;
  engineNumber: string | null;
  publicSlug: string;
  createdAt: Date;
};

export type Attachment = {
  id: string;
  recordId: string;
  kind: AttachmentKind;
  position: number;
  url: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
};

/** Adjunto ya descargado y medido en el servidor, listo para sellar en un registro. */
export type VerifiedAttachment = Pick<Attachment, "kind" | "url" | "contentType" | "sizeBytes" | "sha256">;

export type RecordRow = LedgerRecord & { workshopName: string; userName: string; attachments: Attachment[] };

export async function findVehicleByPlate(plate: string): Promise<Vehicle | null> {
  const rows = await db()<Vehicle[]>`SELECT * FROM vehicles WHERE plate = ${plate}`;
  return rows[0] ?? null;
}

export async function findVehicleById(id: string): Promise<Vehicle | null> {
  const rows = await db()<Vehicle[]>`SELECT * FROM vehicles WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function findVehicleBySlug(slug: string): Promise<Vehicle | null> {
  const rows = await db()<Vehicle[]>`SELECT * FROM vehicles WHERE public_slug = ${slug}`;
  return rows[0] ?? null;
}

/** Registros del auto en orden de carga (el orden de la cadena de hashes). */
export async function listRecords(vehicleId: string): Promise<RecordRow[]> {
  const sql = db();
  const records = await sql<Omit<RecordRow, "attachments">[]>`
    SELECT r.id, r.vehicle_id, r.workshop_id, r.user_id, r.type, r.odometer_km,
           r.performed_on::text AS performed_on, r.items, r.notes, r.corrects_id,
           r.prev_hash, r.hash, r.created_at,
           w.name AS workshop_name, u.name AS user_name
    FROM service_records r
    JOIN workshops w ON w.id = r.workshop_id
    JOIN users u ON u.id = r.user_id
    WHERE r.vehicle_id = ${vehicleId}
    ORDER BY r.created_at ASC, r.id ASC
  `;
  if (records.length === 0) return [];

  const attachments = await sql<Attachment[]>`
    SELECT a.id, a.record_id, a.kind, a.position, a.url, a.content_type, a.size_bytes, a.sha256
    FROM record_attachments a
    JOIN service_records r ON r.id = a.record_id
    WHERE r.vehicle_id = ${vehicleId}
    ORDER BY a.record_id, a.position
  `;
  const byRecord = new Map<string, Attachment[]>();
  for (const a of attachments) {
    const list = byRecord.get(a.recordId) ?? [];
    list.push(a);
    byRecord.set(a.recordId, list);
  }
  return records.map((r) => ({ ...r, attachments: byRecord.get(r.id) ?? [] }));
}

export type RecentVehicle = Vehicle & { lastActivity: Date; lastType: RecordType | null };

/** Autos con los que trabajó el taller, el más reciente primero. */
export async function recentVehicles(workshopId: string, limit = 8): Promise<RecentVehicle[]> {
  return db()<RecentVehicle[]>`
    SELECT v.*, act.last_activity, act.last_type
    FROM vehicles v
    JOIN LATERAL (
      SELECT r.created_at AS last_activity, r.type AS last_type
      FROM service_records r
      WHERE r.vehicle_id = v.id AND r.workshop_id = ${workshopId}
      ORDER BY r.created_at DESC
      LIMIT 1
    ) act ON true
    UNION ALL
    SELECT v.*, v.created_at AS last_activity, NULL::record_type AS last_type
    FROM vehicles v
    WHERE v.created_by_workshop = ${workshopId}
      AND NOT EXISTS (SELECT 1 FROM service_records r WHERE r.vehicle_id = v.id AND r.workshop_id = ${workshopId})
    ORDER BY last_activity DESC
    LIMIT ${limit}
  `;
}

export async function createVehicle(input: {
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number | null;
  bodyType: string | null;
  engineNumber: string | null;
  workshopId: string;
}): Promise<Vehicle> {
  const slug = randomBytes(9).toString("base64url"); // 12 caracteres, no adivinable
  const [v] = await db()<Vehicle[]>`
    INSERT INTO vehicles (plate, vin, make, model, year, body_type, engine_number, public_slug, created_by_workshop)
    VALUES (${input.plate}, ${input.vin}, ${input.make}, ${input.model}, ${input.year}, ${input.bodyType}, ${input.engineNumber}, ${slug}, ${input.workshopId})
    RETURNING *
  `;
  return v;
}

/** Completa chasis o motor solo si estaban vacíos (no pisa datos ya cargados). */
export async function completeVehicle(id: string, data: { vin: string | null; engineNumber: string | null }) {
  const sql = db();
  if (data.vin) await sql`UPDATE vehicles SET vin = ${data.vin} WHERE id = ${id} AND vin IS NULL`;
  if (data.engineNumber) await sql`UPDATE vehicles SET engine_number = ${data.engineNumber} WHERE id = ${id} AND engine_number IS NULL`;
}

export async function lastOdometer(vehicleId: string): Promise<number | null> {
  const rows = await db()<{ km: number | null }[]>`
    SELECT max(odometer_km) AS km FROM service_records WHERE vehicle_id = ${vehicleId}
  `;
  return rows[0]?.km ?? null;
}

/**
 * Agrega un registro al final de la cadena del auto.
 * Bloquea la fila del auto para que dos cargas simultáneas no tomen el mismo hash anterior.
 */
export async function appendRecord(input: {
  vehicleId: string;
  workshopId: string;
  userId: string;
  type: RecordType;
  odometerKm: number;
  performedOn: string;
  items: string[];
  notes: string | null;
  correctsId: string | null;
  attachments: VerifiedAttachment[];
}): Promise<string> {
  const { attachments, ...fields } = input;
  return db().begin(async (tx) => {
    await tx`SELECT id FROM vehicles WHERE id = ${input.vehicleId} FOR UPDATE`;
    const last = await tx<{ hash: string }[]>`
      SELECT hash FROM service_records
      WHERE vehicle_id = ${input.vehicleId}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `;
    const prevHash = last[0]?.hash ?? null;
    // Milisegundos exactos: es lo que entra en el hash y lo que se vuelve a leer al verificar.
    const createdAt = new Date();
    const seals = attachments.map((a) => ({ kind: a.kind, sha256: a.sha256 }));
    const hash = computeHash({ ...fields, prevHash, createdAt, attachments: seals });

    const [row] = await tx<{ id: string }[]>`
      INSERT INTO service_records
        (vehicle_id, workshop_id, user_id, type, odometer_km, performed_on, items, notes, corrects_id, prev_hash, hash, created_at)
      VALUES
        (${input.vehicleId}, ${input.workshopId}, ${input.userId}, ${input.type}, ${input.odometerKm},
         ${input.performedOn}, ${tx.array(input.items)}::text[], ${input.notes}, ${input.correctsId}, ${prevHash}, ${hash}, ${createdAt})
      RETURNING id
    `;

    for (const [position, a] of attachments.entries()) {
      await tx`
        INSERT INTO record_attachments (record_id, kind, position, url, content_type, size_bytes, sha256)
        VALUES (${row.id}, ${a.kind}, ${position}, ${a.url}, ${a.contentType}, ${a.sizeBytes}, ${a.sha256})
      `;
    }
    return row.id;
  });
}
