import Link from "next/link";
import { Plate } from "@/components/Plate";
import { RECORD_LABELS } from "@/lib/records-meta";
import type { PanelRecord, RecordFilters } from "@/lib/panel";
import { SortTh, tableCls, tdCls, theadCls, trCls } from "./Table";

const fmtDay = (iso: string) => iso.split("-").reverse().join("/");

/** Tabla de registros del taller. Sin `f` no ordena (vista corta del resumen). */
export function RecordsTable({ rows, f, href, showWorkshop = false }: { rows: PanelRecord[]; f?: RecordFilters; href?: (over: Record<string, string | number | null>) => string; showWorkshop?: boolean }) {
  const th = (label: string, col: string, align: "left" | "right" = "left", defaultDir: "asc" | "desc" = "asc") =>
    f && href ? (
      <SortTh label={label} col={col} sort={f.sort} dir={f.dir} href={href} align={align} defaultDir={defaultDir} />
    ) : (
      <th scope="col" className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>{label}</th>
    );
  return (
    <div className="overflow-x-auto">
      <table className={tableCls}>
        <thead className={theadCls}>
          <tr>
            {th("Fecha", "fecha", "left", "desc")}
            {th("Patente", "patente")}
            <th scope="col" className="px-4 py-3 text-left font-semibold">Vehículo</th>
            {th("Tipo", "tipo")}
            {th("Km", "km", "right", "desc")}
            <th scope="col" className="px-4 py-3 text-left font-semibold">Trabajos</th>
            <th scope="col" className="px-4 py-3 text-left font-semibold">Respaldo</th>
            {showWorkshop && <th scope="col" className="px-4 py-3 text-left font-semibold">Taller</th>}
            {th("Cargó", "cargado", "left", "desc")}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`${trCls} ${r.corrected ? "text-muted" : ""}`}>
              <td className={`${tdCls} font-mono whitespace-nowrap`}>{fmtDay(r.performedOn)}</td>
              <td className={tdCls}>
                <Link href={`/panel/vehiculos/${r.plate}`}><Plate plate={r.plate} size="sm" /></Link>
              </td>
              <td className={tdCls}>
                <Link href={`/panel/vehiculos/${r.plate}`} className="font-semibold hover:text-accent">{r.make} {r.model}</Link>
              </td>
              <td className={tdCls}>
                <span className={r.corrected ? "line-through" : ""}>{RECORD_LABELS[r.type]}</span>
                {r.corrected && <span className="ml-1.5 text-[11px] font-semibold text-warn">Corregido</span>}
              </td>
              <td className={`${tdCls} text-right font-mono`}>{r.odometerKm.toLocaleString("es-AR")}</td>
              <td className={`${tdCls} max-w-[320px] truncate`} title={r.items.join(", ")}>{r.items.join(", ") || "—"}</td>
              <td className={tdCls}>
                {r.backed ? (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-ok">Con respaldo</span>
                ) : (
                  <span className="text-xs whitespace-nowrap text-muted">{r.attachments ? `${r.attachments} foto${r.attachments === 1 ? "" : "s"}` : "Sin adjuntos"}</span>
                )}
              </td>
              {showWorkshop && <td className={`${tdCls} whitespace-nowrap font-semibold`}>{r.workshopName}</td>}
              <td className={`${tdCls} whitespace-nowrap`}>
                <div>{r.userName}</div>
                <div className="font-mono text-[11px] text-muted">
                  {r.createdAt.toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
