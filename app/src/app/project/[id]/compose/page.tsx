'use client';

import { use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useFigures } from '@/hooks/useFigures';
import { useSurface } from '@/hooks/useSurface';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Layers, AlertCircle, ArrowLeft } from 'lucide-react';

const CompositionCanvas = dynamic(
  () =>
    import('@/components/compose/CompositionCanvas').then((m) => ({
      default: m.CompositionCanvas,
    })),
  { ssr: false, loading: () => <Skeleton className="h-[500px] rounded-2xl" /> },
);

export default function ComposePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: figures, isLoading: figuresLoading } = useFigures(id);
  const { data: surface, isLoading: surfaceLoading } = useSurface(id);

  const isLoading = figuresLoading || surfaceLoading;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 animate-in-page">
        <Skeleton className="h-[500px] rounded-2xl" />
      </div>
    );
  }

  if (!surface) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-6 animate-in-page">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
          <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <h2 className="text-xl font-light mb-2">No surface defined</h2>
        <p className="text-muted-foreground mb-6">
          Define your physical surface first before composing.
        </p>
        <Link href={`/project/${id}/surface`}>
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go to Surface
          </Button>
        </Link>
      </div>
    );
  }

  const styledFigures = figures?.filter((f) => f.styled_url || f.original_photo_url) ?? [];

  if (styledFigures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-6 animate-in-page">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
          <Layers className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <h2 className="text-xl font-light mb-2">No figures to compose</h2>
        <p className="text-muted-foreground mb-6">Upload photos and their styled versions first.</p>
        <Link href={`/project/${id}/figures`}>
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go to Figures
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6 animate-in-page">
      <div>
        <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">Compose</h2>
        <p className="text-muted-foreground mt-2 text-lg font-light">
          Drag figures into position. Red dashed lines show panel seams.
        </p>
      </div>
      <CompositionCanvas projectId={id} figures={styledFigures} surface={surface} />
    </div>
  );
}
