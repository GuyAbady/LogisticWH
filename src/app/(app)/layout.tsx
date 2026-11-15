import { requireRole } from "@/lib/dal";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole();
  return <AppShell user={user}>{children}</AppShell>;
}
