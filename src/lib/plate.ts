/** Patentes argentinas: AA123BB (Mercosur, autos), A123BCD (Mercosur, motos) y ABC123 (formato viejo). */
const PATTERNS = [/^[A-Z]{2}\d{3}[A-Z]{2}$/, /^[A-Z]\d{3}[A-Z]{3}$/, /^[A-Z]{3}\d{3}$/];

/** Mayúsculas, sin espacios, guiones ni puntos: "ae 482-kd" -> "AE482KD". */
export function normalizePlate(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidPlate(plate: string): boolean {
  return PATTERNS.some((p) => p.test(plate));
}

/** Formato de lectura: "AE482KD" -> "AE 482 KD", "OKB903" -> "OKB 903". */
export function formatPlate(plate: string): string {
  if (/^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plate)) return `${plate.slice(0, 2)} ${plate.slice(2, 5)} ${plate.slice(5)}`;
  if (/^[A-Z]\d{3}[A-Z]{3}$/.test(plate)) return `${plate.slice(0, 1)} ${plate.slice(1, 4)} ${plate.slice(4)}`;
  if (/^[A-Z]{3}\d{3}$/.test(plate)) return `${plate.slice(0, 3)} ${plate.slice(3)}`;
  return plate;
}

/** VIN de 17 caracteres, sin I, O ni Q. */
export function normalizeVin(input: string): string | null {
  const vin = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!vin) return null;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : "INVALID";
}

/** VIN leído de una foto: 17 caracteres sin I, O, Q. Corrige las confusiones inequívocas (O/Q→0, I→1). */
export function cleanVin(raw: string): string | null {
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/[OQ]/g, "0").replace(/I/g, "1");
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(v) ? v : null;
}
