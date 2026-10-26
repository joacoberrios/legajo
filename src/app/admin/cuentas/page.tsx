import { AccountsView } from "@/components/admin/AccountsView";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAccounts({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return (
    <main data-wide className="mx-auto max-w-[1400px] px-5 py-6">
      <AdminNav current="/admin/cuentas" />
      <AccountsView sp={await searchParams} base="/admin" />
    </main>
  );
}
