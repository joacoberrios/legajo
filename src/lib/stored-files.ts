import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";

/** Tope por archivo guardado en la base (Vercel corta los pedidos de más de 4,5 MB). */
export const DB_FILE_MAX_BYTES = 4 * 1024 * 1024;

const ID = /^db:([0-9a-f-]{36})$/i;

/** Id del archivo si la URL del adjunto apunta a la base ('db:<uuid>'). */
export function storedFileId(url: string): string | null {
  return ID.exec(url)?.[1] ?? null;
}

export async function saveFile(workshopId: string, contentType: string, bytes: Uint8Array): Promise<string> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const [row] = await db()<{ id: string }[]>`
    INSERT INTO stored_files (workshop_id, content_type, size_bytes, sha256, data)
    VALUES (${workshopId}, ${contentType}, ${bytes.byteLength}, ${sha256}, ${Buffer.from(bytes)})
    RETURNING id
  `;
  return `db:${row.id}`;
}

/** Lee un archivo; si se pasa el taller, solo lo devuelve si es de ese taller. */
export async function readFile(id: string, workshopId?: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  const rows = workshopId
    ? await db()<{ contentType: string; data: Buffer }[]>`SELECT content_type, data FROM stored_files WHERE id = ${id} AND workshop_id = ${workshopId}`
    : await db()<{ contentType: string; data: Buffer }[]>`SELECT content_type, data FROM stored_files WHERE id = ${id}`;
  const r = rows[0];
  return r ? { contentType: r.contentType, bytes: r.data } : null;
}
