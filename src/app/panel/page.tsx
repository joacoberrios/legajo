import Link from "next/link";
import { Plate } from "@/components/Plate";
import { btnPrimary, PageHeader, Stat } from "@/components/panel/PanelShell";
import { ReportsList } from "@/components/panel/ReportsList";
import { RecordsTable } from "@/components/panel/RecordsTable";
import { tableCls, tdCls, theadCls, trCls } from "@/components/panel/Table";
import { listFollowed, listReports, STAGE_LABELS } from "@/lib/agency";
import { requireUser } from "@/lib/auth";
import { agencySummary, panelRecords, recordFilters, workshopSummary } from "@/lib/panel";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const user = await requireUser();
  return user.workshopKind === "agencia" ? <AgencyHome workshopId={user.workshopId} name={user.workshopName} /> : <WorkshopHome workshopId={user.workshopId} name={user.workshopName} />;
}

async function WorkshopHome({ workshopId, name }: { workshopId: string; name: string }) {
  const [s, recent] = await Promise.all([workshopSummary(workshopId), panelRecords(workshopId, { ...recordFilters({}), page: 1 }, 10)]);
  const delta = s.recordsMonth - s.recordsPrevMonth;
  return (
    <>
      <PageHeader title={name} sub="Resumen del taller">
        <Link href="/panel/vehiculos/nuevo" className={btnPrimary}>+ Nuevo auto</Link>
      </PageHeader>
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Vehículos" value={s.vehicles} note="Dados de alta o atendidos" />
        <Stat label="Registros este mes" value={s.recordsMonth} note={`${delta >= 0 ? "+" : ""}${delta} contra el mes anterior`} />
        <Stat label="Registros totales" value={s.records} note={`${s.users} usuario${s.users === 1 ? "" : "s"} cargando`} />
        <Stat label="Con respaldo" value={`${s.backedPct}%`} note="Con foto del odómetro o comprobante" />
      </div>
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <h2 className="font-bold">Últimos registros</h2>
          <Link href="/panel/registros" className="text-sm font-semibold text-accent hover:underline">Ver todos →</Link>
        </div>
        {recent.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Todavía no cargaste registros. Empezá dando de alta un auto.</p>
        ) : (
          <RecordsTable rows={recent.rows} />
        )}
      </section>
    </>
  );
}

async function AgencyHome({ workshopId, name }: { workshopId: string; name: string }) {
  const [s, followed, reports] = await Promise.all([agencySummary(workshopId), listFollowed(workshopId), listReports(workshopId, 8)]);
  const news = followed.filter((f) => f.records > f.seenRecords && f.stage !== "vendido");
  return (
    <>
      <PageHeader title={name} sub="Resumen de la agencia">
        <Link href="/panel/vehiculos/nuevo" className={btnPrimary}>Revisar una patente</Link>
      </PageHeader>
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="En stock" value={s.stock} note={`${s.evaluating} evaluando · ${s.sold} vendidos`} />
        <Stat label="Con novedades" value={s.withNews} note="Registros nuevos desde tu última consulta" />
        <Stat label="Informes este mes" value={s.reportsMonth} note="Informes verificados emitidos" />
        <Stat label="Consultas este mes" value={s.viewsMonth} note="Legajos abiertos por tu equipo" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="font-bold">Autos con novedades</h2>
            <Link href="/panel/vehiculos" className="text-sm font-semibold text-accent hover:underline">Mis autos →</Link>
          </div>
          {news.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">Sin novedades en los autos que seguís.</p>
          ) : (
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Patente</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Vehículo</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Etapa</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Nuevos</th>
                </tr>
              </thead>
              <tbody>
                {news.map((f) => (
                  <tr key={f.vehicleId} className={trCls}>
                    <td className={tdCls}><Link href={`/panel/vehiculos/${f.plate}`}><Plate plate={f.plate} size="sm" /></Link></td>
                    <td className={tdCls}><Link href={`/panel/vehiculos/${f.plate}`} className="font-semibold hover:text-accent">{f.make} {f.model}</Link></td>
                    <td className={tdCls}>{STAGE_LABELS[f.stage]}</td>
                    <td className={`${tdCls} text-right`}><span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">+{f.records - f.seenRecords}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
            <h2 className="font-bold">Últimos informes</h2>
            <Link href="/panel/informes" className="text-sm font-semibold text-accent hover:underline">Ver todos →</Link>
          </div>
          <ReportsList reports={reports} />
        </section>
      </div>
    </>
  );
}
