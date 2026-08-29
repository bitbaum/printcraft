import { AppShell } from '@/components/layout/AppShell';
import { ProjectStepNav } from '@/components/layout/ProjectStepNav';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <AppShell>
      <ProjectStepNav projectId={id} />
      <div className="flex-1 flex flex-col">{children}</div>
    </AppShell>
  );
}
