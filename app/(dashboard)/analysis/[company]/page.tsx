import { AnalysisCompanyPage } from "@/features/dashboard/dashboard-client";

export default async function Page({ params }: { params: Promise<{ company: string }> }) {
  const { company } = await params;
  return <AnalysisCompanyPage company={company} />;
}
