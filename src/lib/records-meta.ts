// Tipos y textos de los registros. Sin dependencias de Node: se puede importar desde el navegador.

export const RECORD_TYPES = ["service", "repair", "diagnosis", "body", "inspection", "origin", "correction"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_LABELS: Record<RecordType, string> = {
  service: "Service",
  repair: "Reparación",
  diagnosis: "Diagnóstico",
  body: "Chapa y pintura",
  inspection: "Revisión técnica (RTO/VTV)",
  origin: "Entrega 0 km",
  correction: "Corrección",
};

/** Tipos que el taller elige al cargar (la corrección se abre desde un registro existente). */
export const SELECTABLE_TYPES: RecordType[] = ["service", "repair", "diagnosis", "body", "inspection", "origin"];

export const COMMON_ITEMS = [
  "Cambio de aceite",
  "Filtro de aceite",
  "Filtro de aire",
  "Filtro de combustible",
  "Filtro de habitáculo",
  "Pastillas de freno",
  "Discos de freno",
  "Correa de distribución",
  "Correa de accesorios",
  "Bujías",
  "Batería",
  "Neumáticos",
  "Alineación y balanceo",
  "Tren delantero",
  "Embrague",
  "Líquido refrigerante",
];

export function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}
