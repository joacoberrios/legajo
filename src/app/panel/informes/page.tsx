import { redirect } from "next/navigation";
import { PageHeader } from "@/components/panel/PanelShell";
import { ReportsList } from "@/components/panel/ReportsList";
import { listReports } from "@/lib/agency";
import { isAdmin, requireUser } from "@/lib/auth";
import { seesNetwork } from "@/lib/panel";
import { ScopeToggle } from "@/components/panel/ScopeToggle";

export const dynamic = "force-dynamic";

export default async function PanelReports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const admin = isAdmin(user);
  if (user.workshopKind !== "agencia" && !admin) redirect("/panel");
  const all = seesNetwork(user, await searchParams);
  const reports = await listReports(user.workshopId, 200, all);
  return (
    <>
      <PageHeader title={all ? "Informes de la red" : "Informes verificados"} sub="Cada informe congela el historial con fecha y código de validación.">
        {admin && <ScopeToggle path="/panel/informes" all={all} />}
      </PageHeader>
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <ReportsList reports={reports} />
      </section>
    </>
  );
}
