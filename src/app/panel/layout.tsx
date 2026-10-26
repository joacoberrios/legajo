import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/PanelShell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Panel · Legajo" };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <PanelShell user={user}>{children}</PanelShell>;
}
