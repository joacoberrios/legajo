import Link from "next/link";
import { setWorkshopVerified } from "@/app/actions/admin";
import { ResetLinkButton } from "@/components/PasswordForms";
import { requireAdmin } from "@/lib/auth";
import { maskCuit } from "@/lib/cuit";
import { formatPhone } from "@/lib/phone";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const PILOT_GOAL = 10; // talleres activos por semana para pasar a la etapa de cobro

type WorkshopRow = {
  id: string;
  name: string;
  cuit: string;
  city: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  verified: boolean;
  createdAt: Date;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  users: number;
  records: number;
  recordsWeek: number;
  viewsWeek: number;
  lastRecord: Date | null;
};

type Totals = { vehicles: number; records: number; backed: number; activeWeek: number; recordsWeek: number; viewsWeek: number };

const formatCuit = maskCuit;

function ago(d: Date | null) {
  if (!d) return "sin registros";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

export default async function AdminPage() {
  await requireAdmin();
  const sql = db();

  const [totals] = await sql<Totals[]>`
    SELECT
      (SELECT count(*) FROM vehicles)::int AS vehicles,
      (SELECT count(*) FROM service_records)::int AS records,
      (SELECT count(DISTINCT record_id) FROM record_attachments WHERE kind IN ('odometer', 'document'))::int AS backed,
      (SELECT count(DISTINCT workshop_id) FROM service_records WHERE created_at > now() - interval '7 days')::int AS active_week,
      (SELECT count(*) FROM service_records WHERE created_at > now() - interval '7 days')::int AS records_week,
      (SELECT count(*) FROM vehicle_views WHERE view_date > current_date - 7)::int AS views_week
  `;

  const workshops = await sql<WorkshopRow[]>`
    SELECT w.id, w.name, w.cuit, w.city, w.phone, w.address, w.lat, w.lng, w.verified, w.created_at,
      owner.id AS owner_id, owner.name AS owner_name, owner.email AS owner_email,
      (SELECT count(*) FROM users u WHERE u.workshop_id = w.id)::int AS users,
      (SELECT count(*) FROM service_records r WHERE r.workshop_id = w.id)::int AS records,
      (SELECT count(*) FROM service_records r WHERE r.workshop_id = w.id AND r.created_at > now() - interval '7 days')::int AS records_week,
      (SELECT count(*) FROM vehicle_views vv WHERE vv.workshop_id = w.id AND vv.view_date > current_date - 7)::int AS views_week,
      (SELECT max(r.created_at) FROM service_records r WHERE r.workshop_id = w.id) AS last_record
    FROM workshops w
    LEFT JOIN LATERAL (
      SELECT id, name, email FROM users u WHERE u.workshop_id = w.id AND u.role = 'owner' ORDER BY u.created_at LIMIT 1
    ) owner ON true
    ORDER BY w.verified ASC, records_week DESC, w.created_at DESC
  `;

  const pending = workshops.filter((w) => !w.verified);
  const verified = workshops.filter((w) => w.verified);
  const goalPct = Math.min(100, Math.round((totals.activeWeek / PILOT_GOAL) * 100));
  const backedPct = totals.records ? Math.round((totals.backed / totals.records) * 100) : 0;

  return (
    <main className="space-y-6 px-5 py-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Legajo · Admin</div>
          <div className="text-xs text-muted">Piloto Gran Mendoza</div>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/stickers" className="flex h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
            Stickers
          </Link>
          <Link href="/taller" className="flex h-11 items-center rounded-xl border border-line bg-white px-3 text-sm font-semibold">
            Ir al taller
          </Link>
        </div>
      </div>

      <section className="space-y-3 rounded-3xl bg-ink p-5 text-paper">
        <div className="flex items-baseline justify-between">
          <h1 className="font-bold">Talleres activos esta semana</h1>
          <span className="font-mono text-sm text-[#B9B7B0]">meta {PILOT_GOAL}</span>
        </div>
        <div className="font-mono text-4xl font-semibold">
          {totals.activeWeek}
          <span className="text-lg text-[#B9B7B0]"> / {PILOT_GOAL}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[#33363B]" role="progressbar" aria-valuenow={totals.activeWeek} aria-valuemin={0} aria-valuemax={PILOT_GOAL}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="text-xs text-[#B9B7B0]">
          Activo = cargó al menos un registro en los últimos 7 días. Al llegar a {PILOT_GOAL}, se pasa a la etapa de cobro.
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label="Registros esta semana" value={totals.recordsWeek} />
        <Stat label="Registros totales" value={totals.records} />
        <Stat label="Autos con legajo" value={totals.vehicles} />
        <Stat label="Registros con respaldo" value={`${backedPct}%`} />
        <Stat label="Consultas esta semana" value={totals.viewsWeek} />
        <Stat label="Consultas por registro" value={totals.recordsWeek ? (totals.viewsWeek / totals.recordsWeek).toFixed(1) : "—"} />
      </dl>

      <section className="space-y-2.5">
        <h2 className="font-bold">Pendientes de verificación ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No hay talleres esperando.</p>
        ) : (
          pending.map((w) => <WorkshopCard key={w.id} w={w} />)
        )}
      </section>

      <section className="space-y-2.5">
        <h2 className="font-bold">Talleres verificados ({verified.length})</h2>
        {verified.map((w) => (
          <WorkshopCard key={w.id} w={w} />
        ))}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card flex flex-col-reverse px-3.5 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-xl font-semibold">{value}</dd>
    </div>
  );
}

function WorkshopCard({ w }: { w: WorkshopRow }) {
  return (
    <article className="card space-y-2.5 px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{w.name}</h3>
          <p className="font-mono text-xs text-muted">CUIT {formatCuit(w.cuit)}</p>
          <p className="text-xs text-muted">{[w.ownerName, w.ownerEmail].filter(Boolean).join(" · ")}</p>
          <p className="text-xs">
            {w.phone ? (
              <a href={`tel:+54${w.phone}`} className="font-mono font-semibold text-accent">{formatPhone(w.phone)}</a>
            ) : (
              <span className="text-warn">sin teléfono</span>
            )}
            {" · "}
            {w.lat !== null && w.lng !== null ? (
              <a href={`https://www.google.com/maps?q=${w.lat},${w.lng}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent">
                {w.address ?? "ver en el mapa"}
              </a>
            ) : (
              <span className="text-warn">sin ubicación</span>
            )}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${w.verified ? "bg-emerald-50 text-ok" : "bg-amber-50 text-warn"}`}>
          {w.verified ? "Verificado" : "Pendiente"}
        </span>
      </div>
      <p className="text-xs text-muted">
        {w.users} usuario{w.users === 1 ? "" : "s"} · {w.records} registros · {w.recordsWeek} esta semana · {w.viewsWeek} consultas · último {ago(w.lastRecord)}
      </p>
      <form action={setWorkshopVerified}>
        <input type="hidden" name="workshopId" value={w.id} />
        <input type="hidden" name="verified" value={w.verified ? "false" : "true"} />
        {w.verified ? (
          <button type="submit" className="h-11 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-muted">
            Quitar verificación
          </button>
        ) : (
          <button type="submit" className="h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white">
            Verificar taller
          </button>
        )}
      </form>
      {w.ownerId && <ResetLinkButton userId={w.ownerId} name={(w.ownerName ?? "").split(" ")[0] || "dueño"} />}
    </article>
  );
}
