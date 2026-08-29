'use client';

import Link from 'next/link';
import { useProjects, useDeleteProject } from '@/hooks/useProjects';
import { AppShell } from '@/components/layout/AppShell';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const deleteProject = useDeleteProject();

  function handleDelete(id: string) {
    if (!confirm('Delete this project?')) return;
    deleteProject.mutate(id, {
      onSuccess: () => toast.success('Project deleted'),
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <AppShell>
      {/* Hero header */}
      <div className="relative hero-gradient">
        <div className="absolute inset-0 bg-dots opacity-30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-12 sm:pt-16 pb-10 sm:pb-12">
          <div className="flex items-end justify-between gap-4">
            <div className="animate-slide-up">
              <h1 className="text-4xl sm:text-5xl font-extralight tracking-tight">Your Projects</h1>
              <p className="text-lg text-muted-foreground mt-3 font-light">
                Artwork compositions in progress
              </p>
            </div>
            <div className="animate-slide-up-delay-1">
              <Link href="/projects/new">
                <Button size="lg" className="rounded-full h-11 px-6">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 w-full animate-in-page">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        ) : projects?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, i) => (
              <div key={project.id} className={`animate-slide-up-delay-${Math.min(i + 1, 4)}`}>
                <ProjectCard project={project} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="h-24 w-24 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-8 animate-slide-up">
              <Sparkles className="h-10 w-10 text-primary/40" />
            </div>
            <h2 className="text-2xl font-light tracking-tight mb-3 animate-slide-up-delay-1">
              No projects yet
            </h2>
            <p className="text-muted-foreground max-w-md mb-8 animate-slide-up-delay-2">
              Create your first artwork composition. Upload photos of real people, choose an art
              style, and bring them together in one scene.
            </p>
            <div className="animate-slide-up-delay-3">
              <Link href="/projects/new">
                <Button size="lg" className="rounded-full h-12 px-8 text-base">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
