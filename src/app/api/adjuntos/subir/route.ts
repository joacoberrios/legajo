import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ATTACHMENT_LIMITS } from "@/lib/records-meta";
import { DB_FILE_MAX_BYTES, saveFile } from "@/lib/stored-files";

/** Recibe una foto o PDF del celular y la guarda en la base. Solo talleres verificados. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Tenés que ingresar para subir archivos." }, { status: 401 });
  if (!user.workshopVerified) return NextResponse.json({ error: "Tu taller todavía no está verificado." }, { status: 403 });

  let file: File | null = null;
  try {
    const f = (await request.formData()).get("file");
    file = f instanceof File ? f : null;
  } catch {}
  if (!file) return NextResponse.json({ error: "No llegó el archivo." }, { status: 400 });

  const type = (file.type || "").split(";")[0].trim().toLowerCase();
  if (!ATTACHMENT_LIMITS.types.includes(type)) return NextResponse.json({ error: "Solo fotos (JPG, PNG, WEBP, HEIC) y PDF." }, { status: 400 });
  if (file.size === 0 || file.size > DB_FILE_MAX_BYTES) return NextResponse.json({ error: "Cada archivo puede pesar hasta 4 MB." }, { status: 400 });

  const url = await saveFile(user.workshopId, type, new Uint8Array(await file.arrayBuffer()));
  return NextResponse.json({ url });
}
