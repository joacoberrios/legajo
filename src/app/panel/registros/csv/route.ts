import { currentUser, isAdmin } from "@/lib/auth";
import { panelRecords, recordFilters, seesNetwork } from "@/lib/panel";
import { RECORD_LABELS } from "@/lib/records-meta";

/** Exporta los registros del taller (con los filtros de la pantalla) a CSV para Excel. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || (user.workshopKind !== "taller" && !isAdmin(user))) return new Response("No autorizado", { status: 401 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { rows } = await panelRecords(user.workshopId, { ...recordFilters(sp), page: 1 }, null, seesNetwork(user, sp));

  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["Fecha", "Patente", "Marca", "Modelo", "Tipo", "Km", "Trabajos", "Notas", "Respaldo", "Corregido", "Taller", "Cargó", "Cargado el"];
  const lines = rows.map((r) =>
    [
      r.performedOn.split("-").reverse().join("/"),
      r.plate,
      r.make,
      r.model,
      RECORD_LABELS[r.type],
      r.odometerKm,
      r.items.join(", "),
      r.notes,
      r.backed ? "Sí" : "No",
      r.corrected ? "Sí" : "No",
      r.workshopName,
      r.userName,
      r.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza" }),
    ].map(cell).join(";"),
  );
  // BOM + punto y coma: Excel en español lo abre con acentos y columnas bien.
  const body = "﻿" + [header.join(";"), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="legajo-registros-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
