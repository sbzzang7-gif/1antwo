import { DashboardShell } from "@/features/dashboard/dashboard-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
