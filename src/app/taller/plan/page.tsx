import { PlanPage } from "@/components/PlanPage";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Plan({ searchParams }: { searchParams: Promise<{ sub?: string; error?: string; cancelada?: string }> }) {
  const user = await requireUser();
  return (
    <main className="px-5">
      <PlanPage user={user} sp={await searchParams} />
    </main>
  );
}
