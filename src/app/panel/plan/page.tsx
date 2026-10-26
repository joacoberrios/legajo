import { PlanPage } from "@/components/PlanPage";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelPlan({ searchParams }: { searchParams: Promise<{ sub?: string; error?: string; cancelada?: string }> }) {
  const user = await requireUser();
  return (
    <div className="max-w-2xl">
      <PlanPage user={user} sp={await searchParams} />
    </div>
  );
}
