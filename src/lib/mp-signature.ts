// Validación de la firma de los avisos (webhooks) de Mercado Pago. Lógica pura, con tests.
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Mercado Pago firma cada aviso con el header `x-signature: ts=<segundos>,v1=<hmac>`.
 * El HMAC-SHA256 (con la clave secreta del webhook) se calcula sobre
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, omitiendo las partes que no vengan.
 */
export function verifyMpSignature(opts: {
  secret: string;
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  maxAgeSeconds?: number;
  now?: number;
}): boolean {
  if (!opts.signature) return false;
  const parts = Object.fromEntries(
    opts.signature.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  if (opts.maxAgeSeconds) {
    const age = Math.abs((opts.now ?? Date.now()) / 1000 - Number(ts.length > 10 ? Number(ts) / 1000 : ts));
    if (!Number.isFinite(age) || age > opts.maxAgeSeconds) return false;
  }

  const id = opts.dataId ? (/^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId) : null;
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1.toLowerCase(), "hex"));
}
