import "server-only";
import { headers } from "next/headers";

/**
 * URL base pública para los links que salen de la app (QR, WhatsApp, invitaciones).
 * En producción en Vercel usa el dominio de producción del proyecto (VERCEL_PROJECT_PRODUCTION_URL),
 * que Vercel mantiene solo: si se agrega un dominio propio, pasa a ser ese.
 * NEXT_PUBLIC_APP_URL queda como override manual y el host de la request como respaldo.
 */
export async function appUrl(): Promise<string> {
  const production = process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
