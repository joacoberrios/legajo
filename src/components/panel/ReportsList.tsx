import { Plate } from "@/components/Plate";
import type { listReports } from "@/lib/agency";
import { formatStickerCode } from "@/lib/sticker-code";
import { tableCls, tdCls, theadCls, trCls } from "./Table";

/** Informes verificados emitidos por la agencia. */
export function ReportsList({ reports }: { reports: Awaited<ReturnType<typeof listReports>> }) {
  if (reports.length === 0) return <p className="px-4 py-10 text-center text-sm text-muted">Todavía no emitiste informes verificados.</p>;
  return (
    <table className={tableCls}>
      <thead className={theadCls}>
        <tr>
          <th scope="col" className="px-4 py-3 text-left font-semibold">Código</th>
          <th scope="col" className="px-4 py-3 text-left font-semibold">Patente</th>
          <th scope="col" className="px-4 py-3 text-left font-semibold">Vehículo</th>
          <th scope="col" className="px-4 py-3 text-right font-semibold">Puntaje</th>
          <th scope="col" className="px-4 py-3 text-right font-semibold">Emitido</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((r) => (
          <tr key={r.code} className={trCls}>
            <td className={tdCls}><a href={`/v/${r.code}`} target="_blank" rel="noreferrer" className="font-mono font-semibold text-accent hover:underline">{formatStickerCode(r.code)}</a></td>
            <td className={tdCls}><Plate plate={r.plate} size="sm" /></td>
            <td className={tdCls}>{r.make} {r.model}</td>
            <td className={`${tdCls} text-right font-mono`}>{r.score ?? "—"}</td>
            <td className={`${tdCls} text-right font-mono text-xs text-muted`}>{r.issuedAt.toLocaleDateString("es-AR")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

