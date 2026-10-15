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

// --- Adjuntos

export const ATTACHMENT_KINDS = ["odometer", "work", "document"] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const ATTACHMENT_LABELS: Record<AttachmentKind, string> = {
  odometer: "Foto del tablero",
  work: "Foto del trabajo",
  document: "Comprobante",
};

export const ATTACHMENT_LIMITS = {
  maxFiles: 8,
  maxBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"],
};

export function isAttachmentKind(value: string): value is AttachmentKind {
  return (ATTACHMENT_KINDS as readonly string[]).includes(value);
}

/** Respaldo documental: foto del tablero o comprobante. Las fotos del trabajo suman pero no alcanzan solas. */
export function hasBacking(attachments: { kind: string }[] | undefined): boolean {
  return !!attachments?.some((a) => a.kind === "odometer" || a.kind === "document");
}
