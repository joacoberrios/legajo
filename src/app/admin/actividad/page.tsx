import Link from "next/link";
import { Plate } from "@/components/Plate";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { RECORD_LABELS, type RecordType } from "@/lib/ledger";
import { normalizePlate } from "@/lib/plate";
import { formatStickerCode } from "@/lib/sticker-code";

export const dynamic = "force-dynamic";

const TABS = { registros: "Registros", altas: "Altas de autos", informes: "Informes", consultas: "Consultas" } as const;
type Tab = keyof typeof TABS;
const PAGE = 50;

type Row = {
  key: string;
  at: Date;
  account: string;
  accountKind: "taller" | "agencia";
  user: string | null;
  plate: string;
  slug: string;
  car: string;
  detail: string;
  extra?: string;
};

const fmt = (d: Date) =>
  d.toLocaleString("es-AR", { timeZone: "America/Argentina/Mendoza", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Actividad de todas las cuentas: qué carga cada taller, qué autos dan de alta, qué consultan e informan. */
export default async function AdminActivity({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cuenta?: string; q?: string; p?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "registros";
  const account = sp.cuenta && /^[0-9a-f-]{36}$/i.test(sp.cuenta) ? sp.cuenta : null;
  const plate = sp.q ? normalizePlate(sp.q) : "";
  const page = Math.max(1, Math.floor(Number(sp.p) || 1));
  const offset = (page - 1) * PAGE;
  const sql = db();

  const accounts = await sql<{ id: string; name: string; kind: "taller" | "agencia" }[]>`
    SELECT id, name, kind FROM workshops ORDER BY name
  `;
  const accFilter = (col: string) => (account ? sql`AND ${sql(col)} = ${account}` : sql``);
  const plateFilter = plate ? sql`AND v.plate LIKE ${`%${plate}%`}` : sql``;

  let rows: Row[] = [];
  if (tab === "registros") {
    const r = await sql<{ id: string; createdAt: Date; account: string; accountKind: "taller" | "agencia"; user: string; plate: string; publicSlug: string; make: string; model: string; type: RecordType; odometerKm: number; performedOn: string; items: string[]; attachments: number }[]>`
      SELECT r.id, r.created_at, w.name AS account, w.kind AS account_kind, u.name AS user, v.plate, v.public_slug, v.make, v.model,
        r.type, r.odometer_km, r.performed_on::text AS performed_on, r.items,
        (SELECT count(*) FROM record_attachments a WHERE a.record_id = r.id)::int AS attachments
      FROM service_records r
      JOIN workshops w ON w.id = r.workshop_id JOIN users u ON u.id = r.user_id JOIN vehicles v ON v.id = r.vehicle_id
      WHERE true ${accFilter("r.workshop_id")} ${plateFilter}
      ORDER BY r.created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}
    `;
    rows = r.map((x) => ({
      key: x.id, at: x.createdAt, account: x.account, accountKind: x.accountKind, user: x.user, plate: x.plate, slug: x.publicSlug,
      car: `${x.make} ${x.model}`,
      detail: `${RECORD_LABELS[x.type]} · ${x.odometerKm.toLocaleString("es-AR")} km · ${x.performedOn.split("-").reverse().join("/")}`,
      extra: [x.items.slice(0, 4).join(", "), x.attachments ? `${x.attachments} adjunto${x.attachments === 1 ? "" : "s"}` : "sin adjuntos"].filter(Boolean).join(" · "),
    }));
  } else if (tab === "altas") {
    const r = await sql<{ id: string; createdAt: Date; account: string | null; accountKind: "taller" | "agencia" | null; plate: string; publicSlug: string; make: string; model: string; year: number | null; vin: string | null; records: number }[]>`
      SELECT v.id, v.created_at, w.name AS account, w.kind AS account_kind, v.plate, v.public_slug, v.make, v.model, v.year, v.vin,
        (SELECT count(*) FROM service_records r WHERE r.vehicle_id = v.id)::int AS records
      FROM vehicles v LEFT JOIN workshops w ON w.id = v.created_by_workshop
      WHERE true ${accFilter("v.created_by_workshop")} ${plateFilter}
      ORDER BY v.created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}
    `;
    rows = r.map((x) => ({
      key: x.id, at: x.createdAt, account: x.account ?? "(cuenta eliminada)", accountKind: x.accountKind ?? "taller", user: null, plate: x.plate, slug: x.publicSlug,
      car: `${x.make} ${x.model}${x.year ? ` · ${x.year}` : ""}`,
      detail: `${x.records} registro${x.records === 1 ? "" : "s"}`,
      extra: x.vin ? `VIN ${x.vin}` : "sin VIN",
    }));
  } else if (tab === "informes") {
    const r = await sql<{ code: string; issuedAt: Date; account: string; accountKind: "taller" | "agencia"; user: string; plate: string; publicSlug: string; make: string; model: string; score: number | null; recordCount: number }[]>`
      SELECT vr.code, vr.issued_at, w.name AS account, w.kind AS account_kind, u.name AS user, v.plate, v.public_slug, v.make, v.model, vr.score, vr.record_count
      FROM verified_reports vr
      JOIN workshops w ON w.id = vr.workshop_id JOIN users u ON u.id = vr.user_id JOIN vehicles v ON v.id = vr.vehicle_id
      WHERE true ${accFilter("vr.workshop_id")} ${plateFilter}
      ORDER BY vr.issued_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}
    `;
    rows = r.map((x) => ({
      key: x.code, at: x.issuedAt, account: x.account, accountKind: x.accountKind, user: x.user, plate: x.plate, slug: x.publicSlug,
      car: `${x.make} ${x.model}`,
      detail: `Informe ${formatStickerCode(x.code)} · puntaje ${x.score ?? "—"} · ${x.recordCount} registros`,
      extra: `/v/${x.code}`,
    }));
  } else {
    const r = await sql<{ vehicleId: string; workshopId: string; viewDate: string; lastAt: Date; account: string; accountKind: "taller" | "agencia"; user: string; plate: string; publicSlug: string; make: string; model: string; source: string; count: number }[]>`
      SELECT vv.vehicle_id, vv.workshop_id, vv.view_date::text AS view_date, vv.last_at, w.name AS account, w.kind AS account_kind, u.name AS user,
        v.plate, v.public_slug, v.make, v.model, vv.source, vv.count
      FROM vehicle_views vv
      JOIN workshops w ON w.id = vv.workshop_id JOIN users u ON u.id = vv.user_id JOIN vehicles v ON v.id = vv.vehicle_id
      WHERE true ${accFilter("vv.workshop_id")} ${plateFilter}
      ORDER BY vv.last_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}
    `;
    rows = r.map((x) => ({
      key: `${x.vehicleId}-${x.workshopId}-${x.viewDate}`, at: x.lastAt, account: x.account, accountKind: x.accountKind, user: x.user, plate: x.plate, slug: x.publicSlug,
      car: `${x.make} ${x.model}`,
      detail: `Consulta por ${x.source}${x.count > 1 ? ` · ${x.count} veces ese día` : ""}`,
    }));
  }

  const hasMore = rows.length > PAGE;
  rows = rows.slice(0, PAGE);
  const link = (over: Record<string, string | number | null>) => {
    const q = new URLSearchParams();
    const merged = { tab, cuenta: account, q: plate || null, p: page, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== null && v !== "" && !(k === "p" && v === 1)) q.set(k, String(v));
    return `/admin/actividad?${q.toString()}`;
  };

  return (
    <main className="space-y-5 px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Actividad</div>
          <div className="text-xs text-muted">Todo lo que cargan y consultan talleres y agencias</div>
        </div>
        <Link href="/admin" className="flex h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">Admin</Link>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Tipo de actividad">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={link({ tab: t, p: 1 })}
            aria-current={t === tab ? "page" : undefined}
            className={`flex h-10 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold ${t === tab ? "bg-ink text-white" : "border border-line bg-white"}`}
          >
            {TABS[t]}
          </Link>
        ))}
      </nav>

      <form action="/admin/actividad" className="grid grid-cols-[1fr_auto] gap-2">
        <input type="hidden" name="tab" value={tab} />
        <label htmlFor="cuenta" className="sr-only">Cuenta</label>
        <select id="cuenta" name="cuenta" defaultValue={account ?? ""} className="col-span-2 h-11 rounded-xl border border-line bg-white px-3 text-sm">
          <option value="">Todas las cuentas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}{a.kind === "agencia" ? " (agencia)" : ""}</option>
          ))}
        </select>
        <label htmlFor="q" className="sr-only">Patente</label>
        <input id="q" name="q" defaultValue={plate} placeholder="Patente" autoCapitalize="characters" className="field h-11 font-mono uppercase" />
        <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white">Filtrar</button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">No hay actividad con esos filtros.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="card space-y-1.5 px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <a href={`/i/${r.slug}`} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2.5">
                  <Plate plate={r.plate} size="sm" />
                  <span className="truncate text-sm font-semibold">{r.car}</span>
                </a>
                <span className="shrink-0 font-mono text-[11px] text-muted">{fmt(r.at)}</span>
              </div>
              <p className="text-sm">{r.detail}</p>
              {r.extra && <p className="truncate text-xs text-muted">{r.extra}</p>}
              <p className="text-xs text-muted">
                <span className="font-semibold text-ink">{r.account}</span>
                {r.accountKind === "agencia" ? " (agencia)" : ""}
                {r.user ? ` · ${r.user}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasMore) && (
        <div className="grid grid-cols-2 gap-2">
          {page > 1 ? <Link href={link({ p: page - 1 })} className="btn-secondary text-sm">← Más nuevos</Link> : <span />}
          {hasMore ? <Link href={link({ p: page + 1 })} className="btn-secondary text-sm">Más viejos →</Link> : <span />}
        </div>
      )}
    </main>
  );
}
