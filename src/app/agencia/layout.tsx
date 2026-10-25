import { AppShell } from "@/components/AppShell";
import { requireAgency } from "@/lib/auth";

export default async function AgenciaLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAgency();
  return <AppShell user={user}>{children}</AppShell>;
}
