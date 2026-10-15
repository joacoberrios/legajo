import "server-only";
import { get } from "@vercel/blob";

/**
 * Modo del Blob store conectado en Vercel. Los stores nuevos suelen ser privados;
 * si el tuyo es público, definí BLOB_ACCESS=public.
 */
export const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "public" ? "public" : "private";

/** Pathname dentro del store a partir de la URL que devolvió la subida. Solo acepta URLs de Vercel Blob. */
export function blobPathname(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".blob.vercel-storage.com")) return null;
    const path = decodeURIComponent(u.pathname).replace(/^\/+/, "");
    if (!path || path.includes("..")) return null;
    return path;
  } catch {
    return null;
  }
}

/** Lee un archivo del store con las credenciales del proyecto (OIDC en Vercel). */
export async function readBlob(pathname: string) {
  const result = await get(pathname, { access: BLOB_ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return { stream: result.stream, contentType: result.blob.contentType };
}
