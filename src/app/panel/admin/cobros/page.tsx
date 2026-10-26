import { BillingView } from "@/components/admin/BillingView";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelBilling({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return <BillingView sp={await searchParams} base="/panel/admin" />;
}
