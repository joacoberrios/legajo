import "server-only";
import { db } from "./db";
import type { SessionUser } from "./auth";

export type ViewSource = "patente" | "qr" | "sticker";

export function viewSource(via: string | undefined): ViewSource {
  return via === "qr" || via === "sticker" ? via : "patente";
}

/** Anota que el taller abrió el legajo. Una fila por auto, taller y día; las recargas suman. Nunca frena la página. */
export async function logView(vehicleId: string, user: SessionUser, source: ViewSource) {
  try {
    await db()`
      INSERT INTO vehicle_views (vehicle_id, workshop_id, user_id, source)
      VALUES (${vehicleId}, ${user.workshopId}, ${user.id}, ${source})
      ON CONFLICT (vehicle_id, workshop_id, view_date)
      DO UPDATE SET count = vehicle_views.count + 1, last_at = now(), user_id = EXCLUDED.user_id
    `;
  } catch (e) {
    console.error("logView", e);
  }
}

export type VehicleView = { workshopName: string; viewDate: string; source: ViewSource };

/** Últimas consultas de talleres a un auto, para el informe público (taller y fecha, sin personas). */
export async function recentViews(vehicleId: string, limit = 10): Promise<{ views: VehicleView[]; workshops90d: number }> {
  const sql = db();
  const [views, [agg]] = await Promise.all([
    sql<VehicleView[]>`
      SELECT w.name AS workshop_name, vv.view_date::text AS view_date, vv.source
      FROM vehicle_views vv JOIN workshops w ON w.id = vv.workshop_id
      WHERE vv.vehicle_id = ${vehicleId}
      ORDER BY vv.view_date DESC, vv.last_at DESC
      LIMIT ${limit}
    `,
    sql<{ workshops90d: number }[]>`
      SELECT count(DISTINCT workshop_id)::int AS workshops90d
      FROM vehicle_views WHERE vehicle_id = ${vehicleId} AND view_date > current_date - 90
    `,
  ]);
  return { views, workshops90d: agg?.workshops90d ?? 0 };
}
