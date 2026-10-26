import { AccountsView } from "@/components/admin/AccountsView";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelAccounts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return <AccountsView sp={await searchParams} base="/panel/admin" />;
}
