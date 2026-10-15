import "server-only";
import { createHash } from "node:crypto";
import { blobPathname, readBlob } from "./blob";
import type { VerifiedAttachment } from "./data";
import { ATTACHMENT_LIMITS, isAttachmentKind } from "./records-meta";

/** Carpeta del store donde cada taller puede subir. La ruta de subida la valida el servidor. */
export function uploadPrefix(workshopId: string) {
  return `adjuntos/${workshopId}/`;
}

type Result = { ok: true; items: VerifiedAttachment[] } | { ok: false; error: string };

/**
 * Recibe lo que mandó el formulario ([{url, kind}]) y no confía en nada:
 * chequea que cada archivo esté en la carpeta del taller dentro del store de Legajo,
 * lo lee con las credenciales del proyecto y calcula su SHA-256, tamaño y tipo reales.
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

  const prefix = uploadPrefix(workshopId);
  const seen = new Set<string>();
  const entries: { url: string; pathname: string; kind: VerifiedAttachment["kind"] }[] = [];
  for (const item of parsed) {
    const kind = String((item as { kind?: unknown })?.kind ?? "");
    const url = String((item as { url?: unknown })?.url ?? "");
    if (!isAttachmentKind(kind)) return { ok: false, error: "Tipo de adjunto inválido." };
    const pathname = blobPathname(url);
    if (!pathname) return { ok: false, error: "Los adjuntos tienen que subirse desde Legajo." };
    if (!pathname.startsWith(prefix)) return { ok: false, error: "Un adjunto no pertenece a tu taller." };
    if (seen.has(pathname)) continue;
    seen.add(pathname);
    entries.push({ url, pathname, kind });
  }

  try {
    const items = await Promise.all(
      entries.map(async ({ url, pathname, kind }): Promise<VerifiedAttachment> => {
        // Se lee por pathname con las credenciales del proyecto: un archivo de otro store no se puede colar.
        const file = await readBlob(pathname);
        if (!file) throw new Error("missing");
        const contentType = (file.contentType ?? "").split(";")[0].trim().toLowerCase();
        if (!ATTACHMENT_LIMITS.types.includes(contentType)) throw new Error("type");
        const bytes = new Uint8Array(await new Response(file.stream).arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > ATTACHMENT_LIMITS.maxBytes) throw new Error("size");
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        return { kind, url, contentType, sizeBytes: bytes.byteLength, sha256 };
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
