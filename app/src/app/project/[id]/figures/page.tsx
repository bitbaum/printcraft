'use client';

import { use } from 'react';
import Link from 'next/link';
import { useFigures } from '@/hooks/useFigures';
import { useProject } from '@/hooks/useProject';
import { FigureUploader } from '@/components/figures/FigureUploader';
import { FigureCard } from '@/components/figures/FigureCard';
import { StylePromptPanel } from '@/components/styles/StylePromptPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Lightbulb } from 'lucide-react';

export default function FiguresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: figures, isLoading } = useFigures(id);
  const { data: project } = useProject(id);
  const style = project?.style ?? null;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10 animate-in-page">
      {/* Header */}
      <div>
        <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">Figures</h2>
        <p className="text-muted-foreground mt-2 text-lg font-light">
          Upload photos of the people for your artwork.
        </p>
      </div>

      <FigureUploader projectId={id} />

      {/* Info callout */}
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.03] p-6 flex gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-3">
          <p className="font-medium">How it works</p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground leading-relaxed">
            <li>Upload the original photo of each person or group</li>
            <li>Choose an art style in the next step</li>
            <li>
              Generate a styled version in an AI tool (Grok, Midjourney) using that style&apos;s
              prompt
            </li>
            <li>
              Upload the styled version using the &quot;Upload styled&quot; button on each card
            </li>
            <li>Compose all styled figures together on the canvas</li>
          </ol>
        </div>
      </div>

      {/* The prompt for step 3 — without it the style choice never reaches the AI tool. */}
      {style ? (
        <StylePromptPanel style={style} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href={`/project/${id}/style`} className="text-primary hover:underline">
            Choose an art style
          </Link>{' '}
          to get the prompt to generate the styled versions with.
        </p>
      )}

      {/* Figures list */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : figures?.length ? (
        <div className="space-y-4">
          {figures.map((figure) => (
            <FigureCard key={figure.id} figure={figure} projectId={id} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-lg font-light">
            No figures yet. Drop photos above to get started.
          </p>
        </div>
      )}

      {figures && figures.length > 0 && (
        <div className="flex justify-end pt-4">
          <Link href={`/project/${id}/style`}>
            <Button size="lg" className="rounded-full h-11 px-6">
              Continue to Style <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
