import "server-only";
import { createHash } from "node:crypto";
import type { VerifiedAttachment } from "./data";
import { ATTACHMENT_LIMITS, isAttachmentKind } from "./records-meta";

/** Carpeta del store donde cada taller puede subir. La ruta de subida la valida el servidor. */
export function uploadPrefix(workshopId: string) {
  return `adjuntos/${workshopId}/`;
}

type Result = { ok: true; items: VerifiedAttachment[] } | { ok: false; error: string };

/**
 * Recibe lo que mandó el formulario ([{url, kind}]) y no confía en nada:
 * chequea que cada archivo esté en el store de Legajo y en la carpeta del taller,
 * lo descarga y calcula su SHA-256, tamaño y tipo reales.
 */
export async function verifyAttachments(raw: string, workshopId: string): Promise<Result> {
  if (!raw) return { ok: true, items: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "No pudimos leer los adjuntos. Volvé a subirlos." };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "Adjuntos inválidos." };
  if (parsed.length > ATTACHMENT_LIMITS.maxFiles) {
    return { ok: false, error: `Máximo ${ATTACHMENT_LIMITS.maxFiles} archivos por registro.` };
  }

  const prefix = "/" + uploadPrefix(workshopId);
  const seen = new Set<string>();
  const entries: { url: URL; kind: VerifiedAttachment["kind"] }[] = [];
  for (const item of parsed) {
    const kind = String((item as { kind?: unknown })?.kind ?? "");
    let url: URL;
    try {
      url = new URL(String((item as { url?: unknown })?.url ?? ""));
    } catch {
      return { ok: false, error: "Un adjunto tiene una dirección inválida." };
    }
    if (!isAttachmentKind(kind)) return { ok: false, error: "Tipo de adjunto inválido." };
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) {
      return { ok: false, error: "Los adjuntos tienen que subirse desde Legajo." };
    }
    if (!decodeURIComponent(url.pathname).startsWith(prefix)) {
      return { ok: false, error: "Un adjunto no pertenece a tu taller." };
    }
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    entries.push({ url, kind });
  }

  try {
    const items = await Promise.all(
      entries.map(async ({ url, kind }): Promise<VerifiedAttachment> => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("missing");
        const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        if (!ATTACHMENT_LIMITS.types.includes(contentType)) throw new Error("type");
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > ATTACHMENT_LIMITS.maxBytes) throw new Error("size");
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        return { kind, url: url.href, contentType, sizeBytes: bytes.byteLength, sha256 };
      }),
    );
    return { ok: true, items };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "";
    if (reason === "type") return { ok: false, error: "Solo se aceptan fotos (JPG, PNG, WEBP, HEIC) y PDF." };
    if (reason === "size") return { ok: false, error: "Cada archivo puede pesar hasta 10 MB." };
    return { ok: false, error: "No pudimos verificar un adjunto. Volvé a subirlo." };
  }
}
