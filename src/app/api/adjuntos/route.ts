import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { uploadPrefix } from "@/lib/attachments";
import { currentUser } from "@/lib/auth";
import { ATTACHMENT_LIMITS } from "@/lib/records-meta";

/**
 * Entrega una URL firmada para que el celular suba el archivo directo a Vercel Blob.
 * Solo talleres verificados, solo a su carpeta, solo fotos y PDF de hasta 10 MB, válida 10 minutos.
 * Funciona con las credenciales OIDC del Blob store (no necesita BLOB_READ_WRITE_TOKEN).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const json = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const user = await currentUser();
        if (!user) throw new Error("Tenés que ingresar para subir archivos.");
        if (!user.workshopVerified) throw new Error("Tu taller todavía no está verificado.");
        if (!pathname.startsWith(uploadPrefix(user.workshopId)) || pathname.includes("..")) {
          throw new Error("Ruta de subida inválida.");
        }
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({
          pathname,
          operations: ["put"],
          allowedContentTypes: ATTACHMENT_LIMITS.types,
          maximumSizeInBytes: ATTACHMENT_LIMITS.maxBytes,
          validUntil,
        });
        return {
          token,
          urlOptions: {
            allowedContentTypes: ATTACHMENT_LIMITS.types,
            maximumSizeInBytes: ATTACHMENT_LIMITS.maxBytes,
            validUntil,
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al subir." }, { status: 400 });
  }
}
