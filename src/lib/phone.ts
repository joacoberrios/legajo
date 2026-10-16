/**
 * Teléfono argentino a sus 10 dígitos nacionales (área + número, sin 0, sin 15, sin +54 9).
 * Acepta "261 15-663-7057", "0261 6637057", "+54 9 261 663 7057", fijos como "261 4231234", etc.
 * Devuelve null si no quedan 10 dígitos.
 */
export function nationalPhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // Saca el 15 que va después del código de área (2, 3 o 4 dígitos): quedan 12 dígitos en vez de 10.
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2);
        break;
      }
    }
  }
  return d.length === 10 ? d : null;
}

/** Celular al formato de WhatsApp (549 + 10 dígitos). */
export function toWhatsAppNumber(input: string): string | null {
  const d = nationalPhone(input);
  return d ? `549${d}` : null;
}

/** Para mostrar: "261 663-7057" (Buenos Aires: "11 4444-5555"). */
export function formatPhone(national: string): string {
  if (!/^\d{10}$/.test(national)) return national;
  const area = national.startsWith("11") ? 2 : 3;
  const rest = national.slice(area);
  return `${national.slice(0, area)} ${rest.slice(0, rest.length - 4)}-${rest.slice(-4)}`;
}
