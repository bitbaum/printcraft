'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, Palette, ArrowUpRight } from 'lucide-react';
import { deriveProjectProgress } from '@/lib/domain/project-progress';
import type { Project } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  // project.status is never written by anything in the app, so it always read
  // 'Draft'. The rows say where the project actually is.
  const progress = deriveProjectProgress({
    figureCount: project.figures?.length ?? 0,
    hasStyle: !!project.style_id,
    hasSurface: (project.surfaces?.length ?? 0) > 0,
    hasComposition: (project.compositions?.length ?? 0) > 0,
  });

  return (
    <Card className="group relative overflow-hidden rounded-2xl border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 card-hover">
      <Link href={`/project/${project.id}/figures`} className="block">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/40 transition-all duration-500" />

        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-medium tracking-tight group-hover:text-primary transition-colors line-clamp-1">
              {project.name}
            </h3>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300 shrink-0 mt-1" />
          </div>

          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-5 leading-relaxed">
              {project.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal rounded-full px-3">
                {progress.label}
              </Badge>
              {project.style && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Palette className="h-3 w-3" />
                  {project.style.name}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-200 h-8 w-8 rounded-full hover:bg-destructive/10"
        onClick={(e) => {
          e.preventDefault();
          onDelete(project.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </Card>
  );
}
