import { AccountView } from "@/components/admin/AccountView";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PanelAccount({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  return <AccountView id={(await params).id} sp={await searchParams} base="/panel/admin" />;
}
