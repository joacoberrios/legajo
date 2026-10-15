// Lógica pura del legajo: tipos de registro, cadena de hashes y análisis del informe.
// No toca la base de datos, así se puede testear sola.
import { createHash } from "node:crypto";
import { hasBacking, type RecordType } from "./records-meta.ts";

export * from "./records-meta.ts";

/** Huella de un adjunto dentro del registro: qué es y el SHA-256 de su contenido. */
export type AttachmentSeal = { kind: string; sha256: string };

/** Lo que entra en el hash: todo lo que define al registro. */
export type HashInput = {
  vehicleId: string;
  workshopId: string;
  userId: string;
  type: RecordType;
  odometerKm: number;
  performedOn: string; // AAAA-MM-DD
  items: string[];
  notes: string | null;
  correctsId: string | null;
  prevHash: string | null;
  createdAt: Date;
  /** En el orden en que se cargaron. Vacío o ausente = registro sin adjuntos. */
  attachments?: AttachmentSeal[];
};

export type LedgerRecord = HashInput & {
  id: string;
  hash: string;
  workshopName?: string;
};

/**
 * SHA-256 de los campos en orden fijo. Cambiar este orden rompe la verificación de registros viejos.
 * v1: registros sin adjuntos (idéntico al formato original). v2: suma la huella de cada adjunto.
 */
export function computeHash(r: HashInput): string {
  const fields = [
    r.vehicleId,
    r.workshopId,
    r.userId,
    r.type,
    r.odometerKm,
    r.performedOn,
    r.items,
    r.notes ?? null,
    r.correctsId ?? null,
    r.prevHash ?? null,
    r.createdAt.toISOString(),
  ];
  const seals = r.attachments ?? [];
  const payload =
    seals.length === 0
      ? JSON.stringify(["legajo:v1", ...fields])
      : JSON.stringify(["legajo:v2", ...fields, seals.map((a) => [a.kind, a.sha256])]);
  return createHash("sha256").update(payload).digest("hex");
}

/** Verifica que cada registro coincida con su hash y apunte al anterior. Espera los registros en orden de carga. */
export function verifyChain(records: LedgerRecord[]): { ok: boolean; brokenAt: string | null } {
  let prev: string | null = null;
  for (const r of records) {
    if ((r.prevHash ?? null) !== prev || computeHash(r) !== r.hash) return { ok: false, brokenAt: r.id };
    prev = r.hash;
  }
  return { ok: true, brokenAt: null };
}

export type Check = { label: string; ok: boolean; note: string };

export type Analysis = {
  score: number | null;
  verdict: string;
  chainOk: boolean;
  currentKm: number | null;
  workshops: number;
  effectiveCount: number;
  backedCount: number;
  kmIssues: number;
  checks: Check[];
};

const DAY = 86_400_000;

/** Puntaje y chequeos del informe. `records` en orden de carga (created_at ascendente). */
export function analyze(records: LedgerRecord[], now: Date = new Date()): Analysis {
  const chain = verifyChain(records);
  const corrected = new Set(records.map((r) => r.correctsId).filter((id): id is string => !!id));
  const effective = records
    .filter((r) => !corrected.has(r.id))
    .sort((a, b) => a.performedOn.localeCompare(b.performedOn) || a.createdAt.getTime() - b.createdAt.getTime());

  let maxKm = -1;
  let kmIssues = 0;
  for (const r of effective) {
    if (r.odometerKm < maxKm) kmIssues++;
    maxKm = Math.max(maxKm, r.odometerKm);
  }

  const workshops = new Set(effective.map((r) => r.workshopId)).size;
  const hasOrigin = effective.some((r) => r.type === "origin");
  const lastService = effective
    .filter((r) => r.type === "service" || r.type === "origin")
    .map((r) => Date.parse(r.performedOn))
    .reduce((a, b) => Math.max(a, b), 0);
  const serviceRecent = lastService > 0 && now.getTime() - lastService <= 365 * DAY;
  const backedCount = effective.filter((r) => hasBacking(r.attachments)).length;
  const backedRatio = effective.length ? backedCount / effective.length : 0;

  const checks: Check[] = [
    {
      label: "Integridad del historial",
      ok: chain.ok,
      note: chain.ok ? "sin alteraciones" : "registros alterados",
    },
    {
      label: "Kilometraje consistente",
      ok: kmIssues === 0,
      note: kmIssues === 0 ? "sin retrocesos" : `${kmIssues} retroceso${kmIssues > 1 ? "s" : ""}`,
    },
    {
      label: "Registros con respaldo",
      ok: effective.length > 0 && backedCount === effective.length,
      note: `${backedCount} de ${effective.length}`,
    },
    {
      label: "Service en los últimos 12 meses",
      ok: serviceRecent,
      note: lastService ? new Date(lastService).toISOString().slice(0, 7) : "sin services",
    },
    {
      label: "Origen 0 km registrado",
      ok: hasOrigin,
      note: hasOrigin ? "sí" : "no",
    },
  ];

  if (effective.length === 0) {
    return { score: null, verdict: "Todavía sin registros", chainOk: chain.ok, currentKm: null, workshops: 0, effectiveCount: 0, backedCount: 0, kmIssues: 0, checks };
  }

  // 40 base + hasta 24 por cantidad + 12 service reciente + 10 origen + hasta 14 por respaldo = 100
  let score = 0;
  if (chain.ok) {
    score =
      40 +
      Math.min(effective.length * 4, 24) +
      (serviceRecent ? 12 : 0) +
      (hasOrigin ? 10 : 0) +
      Math.round(backedRatio * 14) -
      Math.min(kmIssues * 20, 40);
    score = Math.max(0, Math.min(100, score));
  }

  const verdict = !chain.ok
    ? "Historial alterado"
    : score >= 80
      ? "Historial muy completo"
      : score >= 60
        ? "Historial aceptable"
        : "Historial con faltantes";

  return { score, verdict, chainOk: chain.ok, currentKm: maxKm, workshops, effectiveCount: effective.length, backedCount, kmIssues, checks };
}
