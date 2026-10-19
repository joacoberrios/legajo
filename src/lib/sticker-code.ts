// Códigos de sticker: 8 caracteres sin los que se confunden al leer o tipear (0/O, 1/I/L). Lógica pura, con tests.

export const STICKER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const STICKER_LENGTH = 8;

/** Código al azar con bytes aleatorios (crypto.getRandomValues en Node y navegador). */
export function randomStickerCode(): string {
  const bytes = new Uint8Array(STICKER_LENGTH * 2);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    if (b >= 248) continue; // 248 = 31 * 8: descarta el sobrante para que todas las letras salgan parejo
    out += STICKER_ALPHABET[b % STICKER_ALPHABET.length];
    if (out.length === STICKER_LENGTH) return out;
  }
  return randomStickerCode();
}

/** Lo que tipeó el mecánico ("abcd-efgh", con espacios) a la forma guardada, o null si no es un código. */
export function normalizeStickerCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== STICKER_LENGTH) return null;
  for (const c of code) if (!STICKER_ALPHABET.includes(c)) return null;
  return code;
}

export function formatStickerCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Código dentro del contenido de un QR (".../q/ABCD2345"), o el código suelto. */
export function stickerCodeFromQr(value: string): string | null {
  const m = value.match(/\/q\/([A-Za-z0-9]{8})(?:[/?#]|$)/);
  if (m) return normalizeStickerCode(m[1]);
  return /^[A-Za-z0-9-\s]{8,10}$/.test(value.trim()) ? normalizeStickerCode(value) : null;
}
