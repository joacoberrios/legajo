import "server-only";
import { isAdmin, type SessionUser } from "./auth";
import { db } from "./db";
import type { RecordType } from "./records-meta";
import type { Stage } from "./agency";

export const PAGE_SIZE = 50;

/** Los admins de Legajo ven toda la red en el panel (salvo que elijan «solo mi cuenta» con ?vista=mia). */
export function seesNetwork(user: SessionUser, sp: Record<string, string | undefined> = {}) {
  return isAdmin(user) && sp.vista !== "mia";
}

export type Dir = "asc" | "desc";
export const dirOf = (v: string | undefined, fallback: Dir): Dir => (v === "asc" || v === "desc" ? v : fallback);
const isoDate = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

// ---------- Vehículos ----------

export const VEHICLE_SORTS = ["actividad", "patente", "marca", "anio", "km", "registros"] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export type VehicleFilters = {
  q: string;
  make: string;
  type: string;
  stage: string;
  from: string | null;
  to: string | null;
  sort: VehicleSort;
  dir: Dir;
  page: number;
};

export function vehicleFilters(sp: Record<string, string | undefined>): VehicleFilters {
  const sort = (VEHICLE_SORTS as readonly string[]).includes(sp.orden ?? "") ? (sp.orden as VehicleSort) : "actividad";
  return {
    q: (sp.q ?? "").trim().slice(0, 60),
    make: (sp.marca ?? "").trim().slice(0, 60),
    type: (sp.tipo ?? "").trim(),
    stage: (sp.etapa ?? "").trim(),
    from: isoDate(sp.desde),
    to: isoDate(sp.hasta),
    sort,
    dir: dirOf(sp.dir, sort === "patente" || sort === "marca" ? "asc" : "desc"),
    page: Math.max(1, Math.floor(Number(sp.p) || 1)),
  };
}

export type PanelVehicle = {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  engineNumber: string | null;
  bodyType: string | null;
  publicSlug: string;
  createdAt: Date;
  records: number;
  mine: number;
  backed: number;
  lastAt: Date | null;
  lastKm: number | null;
  lastType: RecordType | null;
  stage: Stage | null;
  seenRecords: number | null;
  total: number;
};

/**
 * Autos de la cuenta: para un taller, los que dio de alta o atendió; para una agencia, los que sigue.
 * Filtros y orden parametrizados (nunca SQL armado con texto del usuario).
 */
export async function panelVehicles(workshopId: string, agency: boolean, f: VehicleFilters, all = false) {
  const sql = db();
  const like = `%${f.q}%`;
  const base = all
    ? sql`
        SELECT v.id, av.stage, av.seen_records FROM vehicles v
        LEFT JOIN agency_vehicles av ON av.vehicle_id = v.id AND av.workshop_id = ${workshopId}`
    : agency
    ? sql`SELECT vehicle_id AS id, stage, seen_records FROM agency_vehicles WHERE workshop_id = ${workshopId}`
    : sql`
        SELECT v.id, NULL::text AS stage, NULL::int AS seen_records FROM vehicles v
        WHERE v.created_by_workshop = ${workshopId}
           OR EXISTS (SELECT 1 FROM service_records r WHERE r.vehicle_id = v.id AND r.workshop_id = ${workshopId})`;

  const rows = await sql<PanelVehicle[]>`
    WITH base AS (${base})
    SELECT v.id, v.plate, v.make, v.model, v.year, v.vin, v.engine_number, v.body_type, v.public_slug, v.created_at,
      b.stage, b.seen_records,
      agg.records, agg.mine, agg.backed, agg.last_at, last.odometer_km AS last_km, last.type AS last_type,
      count(*) OVER()::int AS total
    FROM base b
    JOIN vehicles v ON v.id = b.id
    LEFT JOIN LATERAL (
      SELECT count(*)::int AS records,
        count(*) FILTER (WHERE r.workshop_id = ${workshopId})::int AS mine,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM record_attachments a WHERE a.record_id = r.id AND a.kind IN ('odometer', 'document')))::int AS backed,
        max(r.created_at) AS last_at
      FROM service_records r WHERE r.vehicle_id = v.id
    ) agg ON true
    LEFT JOIN LATERAL (
      SELECT r.odometer_km, r.type FROM service_records r WHERE r.vehicle_id = v.id ORDER BY r.created_at DESC LIMIT 1
    ) last ON true
    WHERE (${f.q} = '' OR v.plate ILIKE ${like} OR v.make ILIKE ${like} OR v.model ILIKE ${like} OR coalesce(v.vin, '') ILIKE ${like})
      AND (${f.make} = '' OR v.make = ${f.make})
      AND (${f.type} = '' OR last.type::text = ${f.type})
      AND (${f.stage} = '' OR b.stage = ${f.stage})
      AND (${f.from}::date IS NULL OR coalesce(agg.last_at, v.created_at) >= ${f.from}::date)
      AND (${f.to}::date IS NULL OR coalesce(agg.last_at, v.created_at) < ${f.to}::date + 1)
    ORDER BY
      CASE WHEN ${f.sort} = 'actividad' AND ${f.dir} = 'asc' THEN coalesce(agg.last_at, v.created_at) END ASC,
      CASE WHEN ${f.sort} = 'actividad' AND ${f.dir} = 'desc' THEN coalesce(agg.last_at, v.created_at) END DESC,
      CASE WHEN ${f.sort} = 'patente' AND ${f.dir} = 'asc' THEN v.plate END ASC,
      CASE WHEN ${f.sort} = 'patente' AND ${f.dir} = 'desc' THEN v.plate END DESC,
      CASE WHEN ${f.sort} = 'marca' AND ${f.dir} = 'asc' THEN v.make || ' ' || v.model END ASC,
      CASE WHEN ${f.sort} = 'marca' AND ${f.dir} = 'desc' THEN v.make || ' ' || v.model END DESC,
      CASE WHEN ${f.sort} = 'anio' AND ${f.dir} = 'asc' THEN v.year END ASC NULLS LAST,
      CASE WHEN ${f.sort} = 'anio' AND ${f.dir} = 'desc' THEN v.year END DESC NULLS LAST,
      CASE WHEN ${f.sort} = 'km' AND ${f.dir} = 'asc' THEN last.odometer_km END ASC NULLS LAST,
      CASE WHEN ${f.sort} = 'km' AND ${f.dir} = 'desc' THEN last.odometer_km END DESC NULLS LAST,
      CASE WHEN ${f.sort} = 'registros' AND ${f.dir} = 'asc' THEN agg.records END ASC,
      CASE WHEN ${f.sort} = 'registros' AND ${f.dir} = 'desc' THEN agg.records END DESC,
      v.plate ASC
    LIMIT ${PAGE_SIZE} OFFSET ${(f.page - 1) * PAGE_SIZE}
  `;

  const makes = await sql<{ make: string }[]>`
    WITH base AS (${base})
    SELECT DISTINCT v.make FROM base b JOIN vehicles v ON v.id = b.id ORDER BY v.make
  `;
  return { rows, total: rows[0]?.total ?? 0, makes: makes.map((m) => m.make) };
}

// ---------- Registros ----------

export const RECORD_SORTS = ["cargado", "fecha", "patente", "km", "tipo"] as const;
export type RecordSort = (typeof RECORD_SORTS)[number];

export type RecordFilters = {
  q: string;
  type: string;
  backed: string; // "" | "si" | "no"
  from: string | null;
  to: string | null;
  sort: RecordSort;
  dir: Dir;
  page: number;
};

export function recordFilters(sp: Record<string, string | undefined>): RecordFilters {
  const sort = (RECORD_SORTS as readonly string[]).includes(sp.orden ?? "") ? (sp.orden as RecordSort) : "cargado";
  return {
    q: (sp.q ?? "").trim().slice(0, 60),
    type: (sp.tipo ?? "").trim(),
    backed: sp.respaldo === "si" || sp.respaldo === "no" ? sp.respaldo : "",
    from: isoDate(sp.desde),
    to: isoDate(sp.hasta),
    sort,
    dir: dirOf(sp.dir, sort === "patente" || sort === "tipo" ? "asc" : "desc"),
    page: Math.max(1, Math.floor(Number(sp.p) || 1)),
  };
}

export type PanelRecord = {
  id: string;
  createdAt: Date;
  performedOn: string;
  type: RecordType;
  odometerKm: number;
  items: string[];
  notes: string | null;
  correctsId: string | null;
  corrected: boolean;
  userName: string;
  workshopName: string;
  plate: string;
  make: string;
  model: string;
  attachments: number;
  backed: boolean;
  total: number;
};

/** Registros cargados por la cuenta. `limit` null = todos (exportación, con tope). */
export async function panelRecords(workshopId: string, f: RecordFilters, limit: number | null = PAGE_SIZE, all = false) {
  const sql = db();
  const like = `%${f.q}%`;
  const rows = await sql<PanelRecord[]>`
    SELECT r.id, r.created_at, r.performed_on::text AS performed_on, r.type, r.odometer_km, r.items, r.notes, r.corrects_id,
      EXISTS (SELECT 1 FROM service_records c WHERE c.corrects_id = r.id) AS corrected,
      u.name AS user_name, w.name AS workshop_name, v.plate, v.make, v.model,
      (SELECT count(*) FROM record_attachments a WHERE a.record_id = r.id)::int AS attachments,
      EXISTS (SELECT 1 FROM record_attachments a WHERE a.record_id = r.id AND a.kind IN ('odometer', 'document')) AS backed,
      count(*) OVER()::int AS total
    FROM service_records r
    JOIN vehicles v ON v.id = r.vehicle_id
    JOIN users u ON u.id = r.user_id
    JOIN workshops w ON w.id = r.workshop_id
    WHERE (${all} OR r.workshop_id = ${workshopId})
      AND (${f.q} = '' OR v.plate ILIKE ${like} OR v.make ILIKE ${like} OR v.model ILIKE ${like} OR array_to_string(r.items, ' ') ILIKE ${like} OR u.name ILIKE ${like} OR w.name ILIKE ${like})
      AND (${f.type} = '' OR r.type::text = ${f.type})
      AND (${f.from}::date IS NULL OR r.performed_on >= ${f.from}::date)
      AND (${f.to}::date IS NULL OR r.performed_on <= ${f.to}::date)
      AND (${f.backed} = '' OR (${f.backed} = 'si') = EXISTS (SELECT 1 FROM record_attachments a WHERE a.record_id = r.id AND a.kind IN ('odometer', 'document')))
    ORDER BY
      CASE WHEN ${f.sort} = 'cargado' AND ${f.dir} = 'asc' THEN r.created_at END ASC,
      CASE WHEN ${f.sort} = 'cargado' AND ${f.dir} = 'desc' THEN r.created_at END DESC,
      CASE WHEN ${f.sort} = 'fecha' AND ${f.dir} = 'asc' THEN r.performed_on END ASC,
      CASE WHEN ${f.sort} = 'fecha' AND ${f.dir} = 'desc' THEN r.performed_on END DESC,
      CASE WHEN ${f.sort} = 'patente' AND ${f.dir} = 'asc' THEN v.plate END ASC,
      CASE WHEN ${f.sort} = 'patente' AND ${f.dir} = 'desc' THEN v.plate END DESC,
      CASE WHEN ${f.sort} = 'km' AND ${f.dir} = 'asc' THEN r.odometer_km END ASC,
      CASE WHEN ${f.sort} = 'km' AND ${f.dir} = 'desc' THEN r.odometer_km END DESC,
      CASE WHEN ${f.sort} = 'tipo' AND ${f.dir} = 'asc' THEN r.type::text END ASC,
      CASE WHEN ${f.sort} = 'tipo' AND ${f.dir} = 'desc' THEN r.type::text END DESC,
      r.created_at DESC
    LIMIT ${limit ?? 5000} OFFSET ${limit ? (f.page - 1) * limit : 0}
  `;
  return { rows, total: rows[0]?.total ?? 0 };
}

// ---------- Resumen ----------

export type WorkshopSummary = {
  vehicles: number;
  records: number;
  recordsMonth: number;
  recordsPrevMonth: number;
  backedPct: number;
  users: number;
};

export async function workshopSummary(workshopId: string, all = false): Promise<WorkshopSummary> {
  const [s] = await db()<(Omit<WorkshopSummary, "backedPct"> & { backed: number })[]>`
    SELECT
      (SELECT count(*) FROM vehicles v WHERE ${all} OR v.created_by_workshop = ${workshopId}
         OR EXISTS (SELECT 1 FROM service_records r WHERE r.vehicle_id = v.id AND r.workshop_id = ${workshopId}))::int AS vehicles,
      (SELECT count(*) FROM service_records WHERE ${all} OR workshop_id = ${workshopId})::int AS records,
      (SELECT count(*) FROM service_records WHERE (${all} OR workshop_id = ${workshopId}) AND created_at >= date_trunc('month', now()))::int AS records_month,
      (SELECT count(*) FROM service_records WHERE (${all} OR workshop_id = ${workshopId})
         AND created_at >= date_trunc('month', now()) - interval '1 month' AND created_at < date_trunc('month', now()))::int AS records_prev_month,
      (SELECT count(DISTINCT a.record_id) FROM record_attachments a JOIN service_records r ON r.id = a.record_id
         WHERE (${all} OR r.workshop_id = ${workshopId}) AND a.kind IN ('odometer', 'document'))::int AS backed,
      (SELECT count(*) FROM users WHERE ${all} OR workshop_id = ${workshopId})::int AS users
  `;
  return { ...s, backedPct: s.records ? Math.round((s.backed / s.records) * 100) : 0 };
}

export type AgencySummary = { followed: number; stock: number; evaluating: number; sold: number; withNews: number; reportsMonth: number; viewsMonth: number };

export async function agencySummary(workshopId: string): Promise<AgencySummary> {
  const [s] = await db()<AgencySummary[]>`
    SELECT
      (SELECT count(*) FROM agency_vehicles WHERE workshop_id = ${workshopId})::int AS followed,
      (SELECT count(*) FROM agency_vehicles WHERE workshop_id = ${workshopId} AND stage = 'stock')::int AS stock,
      (SELECT count(*) FROM agency_vehicles WHERE workshop_id = ${workshopId} AND stage = 'evaluando')::int AS evaluating,
      (SELECT count(*) FROM agency_vehicles WHERE workshop_id = ${workshopId} AND stage = 'vendido')::int AS sold,
      (SELECT count(*) FROM agency_vehicles av WHERE av.workshop_id = ${workshopId} AND av.stage <> 'vendido'
         AND (SELECT count(*) FROM service_records r WHERE r.vehicle_id = av.vehicle_id) > av.seen_records)::int AS with_news,
      (SELECT count(*) FROM verified_reports WHERE workshop_id = ${workshopId} AND issued_at >= date_trunc('month', now()))::int AS reports_month,
      (SELECT coalesce(sum(count), 0) FROM vehicle_views WHERE workshop_id = ${workshopId} AND view_date >= date_trunc('month', now())::date)::int AS views_month
  `;
  return s;
}
