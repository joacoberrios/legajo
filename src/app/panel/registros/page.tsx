import Link from "next/link";
import { redirect } from "next/navigation";
import { btnSecondary, input, PageHeader } from "@/components/panel/PanelShell";
import { RecordsTable } from "@/components/panel/RecordsTable";
import { makeHref, Pager } from "@/components/panel/Table";
import { requireUser } from "@/lib/auth";
import { PAGE_SIZE, panelRecords, recordFilters } from "@/lib/panel";
import { RECORD_LABELS, RECORD_TYPES } from "@/lib/records-meta";

export const dynamic = "force-dynamic";

export default async function PanelRecords({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (user.workshopKind !== "taller") redirect("/panel");
  const f = recordFilters(await searchParams);
  const { rows, total } = await panelRecords(user.workshopId, f);
  const current = { q: f.q, tipo: f.type, respaldo: f.backed, desde: f.from, hasta: f.to, orden: f.sort, dir: f.dir, p: f.page };
  const href = makeHref("/panel/registros", current);
  const csv = makeHref("/panel/registros/csv", { ...current, p: null })({});
  const active = f.q || f.type || f.backed || f.from || f.to;

  return (
    <>
      <PageHeader title="Registros" sub="Todos los trabajos que cargó tu taller, firmados e inalterables.">
        <a href={csv} className={btnSecondary}>Exportar CSV</a>
      </PageHeader>

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <form action="/panel/registros" className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-4">
          <input type="hidden" name="orden" value={f.sort} />
          <input type="hidden" name="dir" value={f.dir} />
          <div className="min-w-[220px] flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-semibold text-muted">Buscar</label>
            <input id="q" name="q" defaultValue={f.q} placeholder="Patente, auto, trabajo o mecánico" className={`${input} w-full`} />
          </div>
          <div>
            <label htmlFor="tipo" className="mb-1 block text-xs font-semibold text-muted">Tipo</label>
            <select id="tipo" name="tipo" defaultValue={f.type} className={`${input} min-w-[150px]`}>
              <option value="">Todos</option>
              {RECORD_TYPES.map((t) => <option key={t} value={t}>{RECORD_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="respaldo" className="mb-1 block text-xs font-semibold text-muted">Respaldo</label>
            <select id="respaldo" name="respaldo" defaultValue={f.backed} className={`${input} min-w-[130px]`}>
              <option value="">Todos</option>
              <option value="si">Con respaldo</option>
              <option value="no">Sin respaldo</option>
            </select>
          </div>
          <div>
            <label htmlFor="desde" className="mb-1 block text-xs font-semibold text-muted">Fecha desde</label>
            <input id="desde" name="desde" type="date" defaultValue={f.from ?? ""} className={input} />
          </div>
          <div>
            <label htmlFor="hasta" className="mb-1 block text-xs font-semibold text-muted">Hasta</label>
            <input id="hasta" name="hasta" type="date" defaultValue={f.to ?? ""} className={input} />
          </div>
          <button type="submit" className={btnSecondary}>Filtrar</button>
          {active && <Link href="/panel/registros" className="h-10 px-1 text-sm leading-10 font-semibold text-muted hover:text-ink">Limpiar</Link>}
        </form>
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{active ? "No hay registros con esos filtros." : "Todavía no cargaste registros."}</p>
        ) : (
          <RecordsTable rows={rows} f={f} href={href} />
        )}
        {total > 0 && <Pager page={f.page} total={total} size={PAGE_SIZE} href={href} />}
      </section>
    </>
  );
}
