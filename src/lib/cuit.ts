/** Mientras se tipea: "20123456789" → "20-12345678-9". Acepta parciales. */
export function maskCuit(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** CUIT/CUIL válido: 11 dígitos, prefijo conocido y dígito verificador correcto (módulo 11). */
export function isValidCuit(input: string): boolean {
  const d = input.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (!["20", "23", "24", "25", "26", "27", "30", "33", "34"].includes(d.slice(0, 2))) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(d[10]);
}
