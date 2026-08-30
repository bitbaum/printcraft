'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import { FigureLayer } from './FigureLayer';
import { CanvasToolbar } from './CanvasToolbar';
import { getTotalDimensions, SEAM_BUFFER_CM } from '@/lib/domain/surface';
import type { PlacementViolation } from '@/lib/domain/surface';
import { useUpdateFigure } from '@/hooks/useFigures';
import { useComposition, useSaveComposition } from '@/hooks/useComposition';
import { useSupabaseUpload } from '@/hooks/useSupabaseUpload';
import { getImageUrl } from '@/lib/supabase/storage';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Figure, Surface } from '@/types/database';
import type Konva from 'konva';

interface CompositionCanvasProps {
  projectId: string;
  figures: Figure[];
  surface: Surface;
}

export function CompositionCanvas({ projectId, figures, surface }: CompositionCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const overlayRef = useRef<Konva.Layer>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedBg, setLoadedBg] = useState<{ path: string; image: HTMLImageElement } | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const updateFigure = useUpdateFigure(projectId);
  // The background is the scene itself. Held only in memory it vanished on
  // refresh, and the export then silently printed a black wall.
  const { data: composition, isLoading: compositionLoading } = useComposition(projectId);
  const saveComposition = useSaveComposition(projectId);
  const { upload } = useSupabaseUpload(projectId);
  const backgroundPath = composition?.background_url ?? null;

  const { width_cm, height_cm } = getTotalDimensions(surface.panels);
  const aspectRatio = width_cm / height_cm;

  // Fit canvas to container
  useEffect(() => {
    function resize() {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = Math.min(w / aspectRatio, window.innerHeight - 200);
      setContainerSize({ width: w, height: h });
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [aspectRatio]);

  // Restore the saved background. crossOrigin is what keeps the Konva stage
  // untainted, so the export can still read pixels back out of it.
  useEffect(() => {
    if (!backgroundPath) return;
    let cancelled = false;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!cancelled) setLoadedBg({ path: backgroundPath, image: img });
    };
    img.onerror = () => {
      if (!cancelled) toast.error('The saved background could not be loaded.');
    };
    img.src = getImageUrl(backgroundPath);
    return () => {
      cancelled = true;
    };
  }, [backgroundPath]);

  // Derived, not stored: a background that no longer matches the saved path is
  // a stale image, and painting it would export a scene the project dropped.
  const bgImage = loadedBg?.path === backgroundPath ? loadedBg.image : null;

  const handleBackgroundUpload = useCallback(
    async (file: File) => {
      setBgUploading(true);
      const result = await upload(file, 'backgrounds');
      setBgUploading(false);
      if (!result) {
        toast.error('Background upload failed — nothing was saved.');
        return;
      }
      // Only the background is stored here. Figure placement lives on the
      // figures rows, and duplicating it into layout would give it two homes.
      saveComposition.mutate(
        { project_id: projectId, background_url: result.path },
        { onError: (err) => toast.error(err.message) },
      );
    },
    [upload, saveComposition, projectId],
  );

  // Build image URLs (synchronous — public bucket)
  const imageUrls: Record<string, string> = {};
  for (const fig of figures) {
    const path = fig.styled_url || fig.original_photo_url;
    if (path) imageUrls[fig.id] = getImageUrl(path);
  }

  const handleDragEnd = useCallback(
    (figureId: string, normX: number, normY: number) => {
      updateFigure.mutate(
        { id: figureId, data: { position_x: normX, position_y: normY } },
        { onError: (err) => toast.error(err.message) },
      );
    },
    [updateFigure],
  );

  const handleScaleChange = useCallback(
    (figureId: string, scale: number) => {
      updateFigure.mutate(
        { id: figureId, data: { scale } },
        { onError: (err) => toast.error(err.message) },
      );
    },
    [updateFigure],
  );

  const handleBlocked = useCallback((violation: PlacementViolation) => {
    toast.info(
      violation.kind === 'dead-zone'
        ? `Kept clear of ${violation.reason} — artwork there would be covered up.`
        : 'Kept off the glass seam — a figure across the joint gets cut in half.',
    );
  }, []);

  const placedFigures = figures.filter((f) => imageUrls[f.id]);

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Figure thumbnails sidebar — desktop only */}
      <div className="hidden lg:flex flex-col gap-2 w-48 shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Figures
        </p>
        {figures.map((fig) => {
          const url = imageUrls[fig.id];
          if (!url) return null;
          return (
            <button
              key={fig.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded-xl border transition-all duration-200 text-left cursor-pointer',
                selectedId === fig.id
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]',
              )}
              onClick={() => setSelectedId(fig.id)}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/[0.03] shrink-0">
                <img src={url} alt={fig.label ?? 'Figure'} className="w-full h-full object-cover" />
              </div>
              <span className="text-xs text-foreground/80 truncate">{fig.label ?? 'Unnamed'}</span>
            </button>
          );
        })}
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col gap-3 relative">
        <div
          ref={containerRef}
          className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/[0.06] canvas-grid-bg"
        >
          <Stage
            ref={stageRef}
            width={containerSize.width}
            height={containerSize.height}
            onClick={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            {/* Background */}
            <Layer>
              <Rect width={containerSize.width} height={containerSize.height} fill="#0a0a0a" />
              {bgImage && (
                <Rect
                  width={containerSize.width}
                  height={containerSize.height}
                  fillPatternImage={bgImage}
                  fillPatternScaleX={containerSize.width / bgImage.width}
                  fillPatternScaleY={containerSize.height / bgImage.height}
                />
              )}
            </Layer>

            {/* Figures */}
            <Layer>
              {placedFigures
                .sort((a, b) => a.z_depth - b.z_depth)
                .map((figure) => (
                  <FigureLayer
                    key={figure.id}
                    figure={figure}
                    imageUrl={imageUrls[figure.id]}
                    canvasWidth={containerSize.width}
                    canvasHeight={containerSize.height}
                    totalWidthCm={width_cm}
                    totalHeightCm={height_cm}
                    deadZones={surface.dead_zones}
                    seams={surface.seam_positions}
                    isSelected={selectedId === figure.id}
                    onSelect={() => setSelectedId(figure.id)}
                    onDragEnd={handleDragEnd}
                    onScaleChange={handleScaleChange}
                    onBlocked={handleBlocked}
                  />
                ))}
            </Layer>

            {/* Constraint overlays — editor guides, hidden during export */}
            <Layer ref={overlayRef} listening={false}>
              {/* Seam lines */}
              {surface.seam_positions.map((seam, i) => {
                const x = (seam.x_cm / width_cm) * containerSize.width;
                return (
                  <Line
                    key={`seam-${i}`}
                    points={[x, 0, x, containerSize.height]}
                    stroke="rgba(255,100,100,0.6)"
                    strokeWidth={2}
                    dash={[8, 4]}
                  />
                );
              })}

              {/* Dead zones */}
              {surface.dead_zones.map((zone, i) => {
                const x = (zone.x_cm / width_cm) * containerSize.width;
                const y =
                  containerSize.height -
                  ((zone.y_cm + zone.height_cm) / height_cm) * containerSize.height;
                const w = (zone.width_cm / width_cm) * containerSize.width;
                const h = (zone.height_cm / height_cm) * containerSize.height;
                return (
                  <Rect
                    key={`dead-${i}`}
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="rgba(255,50,50,0.15)"
                    stroke="rgba(255,50,50,0.5)"
                    strokeWidth={1}
                    dash={[4, 2]}
                  />
                );
              })}

              {/* Seam buffer zones */}
              {surface.seam_positions.map((seam, i) => {
                const x = ((seam.x_cm - SEAM_BUFFER_CM) / width_cm) * containerSize.width;
                const w = ((SEAM_BUFFER_CM * 2) / width_cm) * containerSize.width;
                return (
                  <Rect
                    key={`buffer-${i}`}
                    x={x}
                    y={0}
                    width={w}
                    height={containerSize.height}
                    fill="rgba(255,100,100,0.05)"
                  />
                );
              })}
            </Layer>
          </Stage>

          {/* Empty state overlay */}
          {placedFigures.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center px-6">
                <p className="text-lg font-light text-white/30 mb-2">No figures placed yet</p>
                <p className="text-sm text-white/20">
                  Upload styled figures, then drag them onto the canvas
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Floating bottom toolbar */}
        <div className="flex justify-center">
          <CanvasToolbar
            stageRef={stageRef}
            overlayRef={overlayRef}
            selectedId={selectedId}
            figures={figures}
            surface={surface}
            projectId={projectId}
            backgroundPending={bgUploading || compositionLoading || (!!backgroundPath && !bgImage)}
            onBackgroundUpload={handleBackgroundUpload}
          />
        </div>
      </div>
    </div>
  );
}
