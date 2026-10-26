// Planes y precios de Legajo. Lógica pura (sin base de datos), con tests.

export type PriceKey = "report_single" | "report_pack3" | "report_extra" | "agencia" | "agencia_pro" | "taller_pro";
export type Prices = Record<PriceKey, number>;
export type PlanKey = "agencia" | "agencia_pro" | "taller_pro";

/** Precios por defecto en pesos (finales). Se pueden cambiar desde el admin sin tocar código. */
export const DEFAULT_PRICES: Prices = {
  report_single: 14900,
  report_pack3: 29900,
  report_extra: 3900,
  agencia: 49900,
  agencia_pro: 119900,
  taller_pro: 9900,
};

export const PLANS: Record<PlanKey, { name: string; kind: "agencia" | "taller"; quota: number; features: string[] }> = {
  agencia: {
    name: "Agencia",
    kind: "agencia",
    quota: 15,
    features: ["Historial completo de cualquier auto", "Mis autos y panel de computadora", "15 informes verificados por mes"],
  },
  agencia_pro: {
    name: "Agencia Pro",
    kind: "agencia",
    quota: 60,
    features: ["Todo lo de Agencia", "60 informes verificados por mes"],
  },
  taller_pro: {
    name: "Taller Pro",
    kind: "taller",
    quota: 0,
    features: ["Historial completo de cualquier auto de la red", "Ideal para presupuestar y diagnosticar autos nuevos en tu taller"],
  },
};

export const PURCHASES: Record<"report_single" | "report_pack3" | "report_extra", { name: string; credits: number }> = {
  report_single: { name: "Informe verificado Legajo", credits: 1 },
  report_pack3: { name: "Pack de 3 informes verificados Legajo", credits: 3 },
  report_extra: { name: "Informe verificado extra", credits: 1 },
};

/** Cuántos registros de un auto ajeno ve un taller sin Taller Pro (los más recientes). */
export const FREE_RECORDS_FOR_OTHERS = 2;

/** Mezcla los precios guardados con los de por defecto, descartando valores inválidos. */
export function resolvePrices(saved: Partial<Record<string, unknown>> | null | undefined): Prices {
  const out = { ...DEFAULT_PRICES };
  for (const k of Object.keys(DEFAULT_PRICES) as PriceKey[]) {
    const v = Number(saved?.[k]);
    if (Number.isInteger(v) && v >= 100 && v <= 10_000_000) out[k] = v;
  }
  return out;
}

/** Precio con el descuento de la cuenta, redondeado a la centena. */
export function discounted(price: number, pct: number): number {
  const p = Math.min(100, Math.max(0, Math.floor(pct)));
  return Math.round((price * (100 - p)) / 100 / 100) * 100;
}

export const formatARS = (n: number) => `$${n.toLocaleString("es-AR")}`;

/** El plan sirve si está autorizado o es cortesía, y no venció (con 3 días de gracia para el débito). */
export function isActive(sub: { status: string; currentPeriodEnd: Date | null } | null, now = new Date()): boolean {
  if (!sub) return false;
  if (sub.status !== "authorized" && sub.status !== "courtesy") return false;
  if (!sub.currentPeriodEnd) return sub.status === "authorized";
  return sub.currentPeriodEnd.getTime() + 3 * 86_400_000 > now.getTime();
}
