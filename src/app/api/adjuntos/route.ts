import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { uploadPrefix } from "@/lib/attachments";
import { currentUser } from "@/lib/auth";
import { ATTACHMENT_LIMITS } from "@/lib/records-meta";

/**
 * Autoriza la subida directa del celular a Vercel Blob.
 * Solo talleres verificados, solo a su carpeta, solo fotos y PDF de hasta 10 MB.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await currentUser();
        if (!user) throw new Error("Tenés que ingresar para subir archivos.");
        if (!user.workshopVerified) throw new Error("Tu taller todavía no está verificado.");
        if (!pathname.startsWith(uploadPrefix(user.workshopId)) || pathname.includes("..")) {
          throw new Error("Ruta de subida inválida.");
        }
        return {
          allowedContentTypes: ATTACHMENT_LIMITS.types,
          maximumSizeInBytes: ATTACHMENT_LIMITS.maxBytes,
          addRandomSuffix: true,
        };
      },
      // El registro se sella al firmar, no al subir: acá no hace falta nada.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al subir." }, { status: 400 });
  }
}
