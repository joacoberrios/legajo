import Link from "next/link";
import { STAGE_LABELS, STAGES } from "@/lib/agency";
import { RECORD_LABELS, SELECTABLE_TYPES } from "@/lib/records-meta";
import type { VehicleFilters } from "@/lib/panel";
import { btnSecondary, input } from "./PanelShell";

/** Barra de filtros de la lista de vehículos (formulario GET: los filtros quedan en la URL). */
export function VehicleFilterBar({ f, makes, agency, mine = false }: { f: VehicleFilters; makes: string[]; agency: boolean; mine?: boolean }) {
  const active = f.q || f.make || f.type || f.stage || f.from || f.to;
  return (
    <form action="/panel/vehiculos" className="flex flex-wrap items-end gap-3 border-b border-line px-4 py-4">
      {mine && <input type="hidden" name="vista" value="mia" />}
      <input type="hidden" name="orden" value={f.sort} />
      <input type="hidden" name="dir" value={f.dir} />
      <div className="min-w-[220px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-semibold text-muted">Buscar</label>
        <input id="q" name="q" defaultValue={f.q} placeholder="Patente, marca, modelo o VIN" className={`${input} w-full`} />
      </div>
      <div>
        <label htmlFor="marca" className="mb-1 block text-xs font-semibold text-muted">Marca</label>
        <select id="marca" name="marca" defaultValue={f.make} className={`${input} min-w-[150px]`}>
          <option value="">Todas</option>
          {makes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {agency ? (
        <div>
          <label htmlFor="etapa" className="mb-1 block text-xs font-semibold text-muted">Etapa</label>
          <select id="etapa" name="etapa" defaultValue={f.stage} className={`${input} min-w-[140px]`}>
            <option value="">Todas</option>
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="tipo" className="mb-1 block text-xs font-semibold text-muted">Último trabajo</label>
          <select id="tipo" name="tipo" defaultValue={f.type} className={`${input} min-w-[160px]`}>
            <option value="">Cualquiera</option>
            {SELECTABLE_TYPES.map((t) => <option key={t} value={t}>{RECORD_LABELS[t]}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="desde" className="mb-1 block text-xs font-semibold text-muted">Actividad desde</label>
        <input id="desde" name="desde" type="date" defaultValue={f.from ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor="hasta" className="mb-1 block text-xs font-semibold text-muted">Hasta</label>
        <input id="hasta" name="hasta" type="date" defaultValue={f.to ?? ""} className={input} />
      </div>
      <button type="submit" className={btnSecondary}>Filtrar</button>
      {active && <Link href="/panel/vehiculos" className="h-10 px-1 text-sm leading-10 font-semibold text-muted hover:text-ink">Limpiar</Link>}
    </form>
  );
}
