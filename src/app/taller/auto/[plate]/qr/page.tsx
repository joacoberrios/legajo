import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Plate } from "@/components/Plate";
import { PrintButton } from "@/components/PrintButton";
import { requireWorkshop } from "@/lib/auth";
import { findVehicleByPlate } from "@/lib/data";
import { normalizePlate } from "@/lib/plate";
import { appUrl } from "@/lib/url";

/** Sticker para el parabrisas: QR al informe público. */
export default async function QrPage({ params }: { params: Promise<{ plate: string }> }) {
  await requireWorkshop();
  const plate = normalizePlate((await params).plate);
  const vehicle = await findVehicleByPlate(plate);
  if (!vehicle) notFound();

  const link = `${await appUrl()}/i/${vehicle.publicSlug}`;
  const svg = await QRCode.toString(link, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#15171a", light: "#ffffff" } });

  return (
    <main className="space-y-6 px-5">
      <Link href={`/taller/auto/${plate}`} className="inline-flex h-11 items-center text-sm font-semibold text-muted print:hidden">
        ← Volver al legajo
      </Link>

      <div className="mx-auto w-64 space-y-3 rounded-3xl border-2 border-ink bg-white p-5 text-center">
        <div className="text-lg font-extrabold tracking-tight">Legajo</div>
        <div className="mx-auto w-48" dangerouslySetInnerHTML={{ __html: svg }} />
        <Plate plate={vehicle.plate} />
        <p className="text-xs text-muted">Escaneá para ver el historial verificado de este auto</p>
      </div>

      <p className="text-center text-xs break-all text-muted print:hidden">{link}</p>
      <div className="print:hidden">
        <PrintButton />
      </div>
    </main>
  );
}
