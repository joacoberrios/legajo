import { notFound, redirect } from "next/navigation";
import { findVehicleBySlug } from "@/lib/data";

/** Destino del escaneo de QR desde la app del taller: abre el legajo completo. */
export default async function ScanRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vehicle = await findVehicleBySlug(slug);
  if (!vehicle) notFound();
  redirect(`/taller/auto/${vehicle.plate}?via=qr`);
}
