'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, Palette, Ruler, Layers, Download, Check, ArrowLeft } from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import { useFigures } from '@/hooks/useFigures'
import { useSurface } from '@/hooks/useSurface'
import { useComposition } from '@/hooks/useComposition'
import { PROJECT_STEPS, type ProjectStepId } from '@/lib/config/project-steps'
import { deriveProjectProgress } from '@/lib/domain/project-progress'

/** Icons are the only per-step thing the nav owns; the steps themselves are config. */
const STEP_ICONS: Record<ProjectStepId, typeof Users> = {
  figures: Users,
  style: Palette,
  surface: Ruler,
  compose: Layers,
  export: Download,
}

export function ProjectStepNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const { data: project } = useProject(projectId)
  const { data: figures } = useFigures(projectId)
  const { data: surface } = useSurface(projectId)
  const { data: composition } = useComposition(projectId)

  // Same derivation the dashboard badge uses, so the two cannot disagree.
  const { completed } = deriveProjectProgress({
    figureCount: figures?.length ?? 0,
    hasStyle: !!project?.style_id,
    hasSurface: !!surface,
    hasComposition: !!composition,
  })
  const completedSteps = new Set<ProjectStepId>(completed)

  const activeIndex = PROJECT_STEPS.findIndex(s => pathname.endsWith(`/${s.href}`))

  return (
    <nav className="border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 md:px-8 py-3 max-w-7xl mx-auto">
        {/* Back button */}
        <Link
          href="/projects"
          className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/[0.04] transition-all shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline max-w-32 truncate">{project?.name ?? 'Back'}</span>
        </Link>

        <div className="h-5 w-px bg-white/[0.08] shrink-0" />

        {/* Steps — horizontally scrollable on mobile */}
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none -mx-1 px-1">
          {PROJECT_STEPS.map((step, i) => {
            const href = `/project/${projectId}/${step.href}`
            const isActive = pathname.endsWith(`/${step.href}`)
            const isComplete = completedSteps.has(step.id)
            const isPast = i < activeIndex
            const Icon = STEP_ICONS[step.id]

            return (
              <div key={step.id} className="flex items-center shrink-0">
                {/* Connector line — hidden on mobile */}
                {i > 0 && (
                  <div
                    className={cn(
                      'step-connector mx-1 hidden md:block',
                      (isPast || (isComplete && i < activeIndex)) && 'completed'
                    )}
                  />
                )}

                <Link
                  href={href}
                  className={cn(
                    'relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : isComplete
                        ? 'text-foreground/80 hover:text-foreground hover:bg-white/[0.04]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
                  )}
                >
                  {isComplete && !isActive ? (
                    <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
