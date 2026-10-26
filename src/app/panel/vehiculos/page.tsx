import Link from "next/link";
import { Plate } from "@/components/Plate";
import { btnPrimary, PageHeader } from "@/components/panel/PanelShell";
import { makeHref, Pager, SortTh, tableCls, tdCls, theadCls, trCls } from "@/components/panel/Table";
import { VehicleFilterBar } from "@/components/panel/VehicleFilters";
import { ScoreBadge } from "@/components/panel/ScoreBadge";
import { STAGE_LABELS } from "@/lib/agency";
import { requireUser } from "@/lib/auth";
import { listRecordsMany } from "@/lib/data";
import { analyze, RECORD_LABELS } from "@/lib/ledger";
import { PAGE_SIZE, panelVehicles, vehicleFilters } from "@/lib/panel";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

export default async function PanelVehicles({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const agency = user.workshopKind === "agencia";
  const f = vehicleFilters(await searchParams);
  const { rows, total, makes } = await panelVehicles(user.workshopId, agency, f);
  const records = await listRecordsMany(rows.map((r) => r.id));
  const href = makeHref("/panel/vehiculos", { q: f.q, marca: f.make, tipo: f.type, etapa: f.stage, desde: f.from, hasta: f.to, orden: f.sort, dir: f.dir, p: f.page });
  const th = (label: string, col: string, align: "left" | "right" = "left", defaultDir: "asc" | "desc" = "asc") => (
    <SortTh label={label} col={col} sort={f.sort} dir={f.dir} href={href} align={align} defaultDir={defaultDir} />
  );

  return (
    <>
      <PageHeader
        title={agency ? "Mis autos" : "Vehículos"}
        sub={agency ? "Los autos que seguís: evaluando, en stock y vendidos." : "Los autos que diste de alta o atendiste en el taller."}
      >
        {agency ? (
          <Link href="/panel/vehiculos/nuevo" className={btnPrimary}>Revisar una patente</Link>
        ) : (
          <Link href="/panel/vehiculos/nuevo" className={btnPrimary}>+ Nuevo auto</Link>
        )}
      </PageHeader>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <VehicleFilterBar f={f} makes={makes} agency={agency} />
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {f.q || f.make || f.type || f.stage || f.from || f.to ? "No hay autos con esos filtros." : agency ? "Todavía no seguís ningún auto." : "Todavía no cargaste ningún auto."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  {th("Patente", "patente")}
                  {th("Vehículo", "marca")}
                  {th("Año", "anio", "right", "desc")}
                  <th scope="col" className="px-4 py-3 text-left font-semibold">VIN</th>
                  {th("Último km", "km", "right", "desc")}
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Último trabajo</th>
                  {th("Registros", "registros", "right", "desc")}
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Puntaje</th>
                  {agency && <th scope="col" className="px-4 py-3 text-left font-semibold">Etapa</th>}
                  {th("Actividad", "actividad", "right", "desc")}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const a = analyze(records.get(v.id) ?? []);
                  const news = agency && v.seenRecords !== null ? v.records - v.seenRecords : 0;
                  return (
                    <tr key={v.id} className={trCls}>
                      <td className={tdCls}>
                        <Link href={`/panel/vehiculos/${v.plate}`} className="inline-block"><Plate plate={v.plate} size="sm" /></Link>
                      </td>
                      <td className={tdCls}>
                        <Link href={`/panel/vehiculos/${v.plate}`} className="font-semibold hover:text-accent">{v.make} {v.model}</Link>
                        {v.bodyType && <div className="text-xs text-muted">{v.bodyType}</div>}
                      </td>
                      <td className={`${tdCls} text-right font-mono`}>{v.year ?? "—"}</td>
                      <td className={`${tdCls} font-mono text-xs`}>{v.vin ?? <span className="text-warn">sin cargar</span>}</td>
                      <td className={`${tdCls} text-right font-mono`}>{v.lastKm !== null ? v.lastKm.toLocaleString("es-AR") : "—"}</td>
                      <td className={tdCls}>{v.lastType ? RECORD_LABELS[v.lastType] : <span className="text-muted">Sin registros</span>}</td>
                      <td className={`${tdCls} text-right font-mono`}>
                        {agency ? v.records : <span title={`${v.mine} de tu taller, ${v.records} en total`}>{v.mine}<span className="text-muted"> / {v.records}</span></span>}
                        {news > 0 && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">+{news}</span>}
                      </td>
                      <td className={`${tdCls} text-right`}>
                        <ScoreBadge score={a.score} ok={a.chainOk} />
                      </td>
                      {agency && <td className={tdCls}>{v.stage ? STAGE_LABELS[v.stage] : "—"}</td>}
                      <td className={`${tdCls} text-right font-mono text-xs text-muted`}>{day(v.lastAt ?? v.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <Pager page={f.page} total={total} size={PAGE_SIZE} href={href} />}
      </section>
    </>
  );
}
