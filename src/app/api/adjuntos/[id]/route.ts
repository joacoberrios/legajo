import { currentUser } from "@/lib/auth";
import { blobPathname, readBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { readFile, storedFileId } from "@/lib/stored-files";

/**
 * Sirve un adjunto a través de la app (el store puede ser privado).
 * Fotos del tablero y del trabajo: públicas, como el informe.
 * Comprobantes: solo para talleres logueados, porque pueden tener datos del dueño.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("No encontrado", { status: 404 });

  const rows = await db()<{ kind: string; url: string; contentType: string }[]>`
    SELECT kind, url, content_type FROM record_attachments WHERE id = ${id}
  `;
  const att = rows[0];
  if (!att) return new Response("No encontrado", { status: 404 });

  const isDocument = att.kind === "document";
  if (isDocument && !(await currentUser())) return new Response("Necesitás ingresar como taller.", { status: 401 });

  const fileId = storedFileId(att.url);
  let body: BodyInit | null = null;
  if (fileId) {
    const f = await readFile(fileId);
    body = f ? new Uint8Array(f.bytes) : null;
  } else {
    const pathname = blobPathname(att.url);
    try {
      body = pathname ? ((await readBlob(pathname))?.stream ?? null) : null;
    } catch {
      body = null; // Blob no disponible (por ejemplo, límite del plan gratis)
    }
  }
  if (!body) return new Response("Archivo no disponible", { status: 404 });

  return new Response(body, {
    headers: {
      "Content-Type": att.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // El archivo de un adjunto nunca cambia (está sellado en el registro).
      "Cache-Control": isDocument ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}
