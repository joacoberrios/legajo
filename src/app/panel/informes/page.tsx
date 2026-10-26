import { redirect } from "next/navigation";
import { PageHeader } from "@/components/panel/PanelShell";
import { ReportsList } from "@/components/panel/ReportsList";
import { listReports } from "@/lib/agency";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelReports() {
  const user = await requireUser();
  if (user.workshopKind !== "agencia") redirect("/panel");
  const reports = await listReports(user.workshopId, 200);
  return (
    <>
      <PageHeader title="Informes verificados" sub="Cada informe congela el historial con fecha y código de validación." />
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <ReportsList reports={reports} />
      </section>
    </>
  );
}
