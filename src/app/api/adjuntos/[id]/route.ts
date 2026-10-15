import { currentUser } from "@/lib/auth";
import { blobPathname, readBlob } from "@/lib/blob";
import { db } from "@/lib/db";

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

  const pathname = blobPathname(att.url);
  const file = pathname ? await readBlob(pathname) : null;
  if (!file) return new Response("Archivo no disponible", { status: 404 });

  return new Response(file.stream, {
    headers: {
      "Content-Type": att.contentType,
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // El archivo de un adjunto nunca cambia (está sellado en el registro).
      "Cache-Control": isDocument ? "private, no-store" : "public, max-age=31536000, immutable",
    },
  });
}
