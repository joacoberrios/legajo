/**
 * Celular argentino al formato de WhatsApp (549 + área + número, sin 0 ni 15).
 * Acepta "261 15-663-7057", "0261 6637057", "+54 9 261 663 7057", etc.
 * Devuelve null si no quedan 10 dígitos de número nacional.
 */
export function toWhatsAppNumber(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
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
  return d.length === 10 ? `549${d}` : null;
}
