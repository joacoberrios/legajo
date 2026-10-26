import { AdminNav } from "@/components/admin/AdminNav";
import { BillingView } from "@/components/admin/BillingView";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminCobros({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return (
    <main data-wide className="mx-auto max-w-[1400px] px-5 py-6">
      <AdminNav current="/admin/cobros" />
      <BillingView sp={await searchParams} base="/admin" />
    </main>
  );
}
