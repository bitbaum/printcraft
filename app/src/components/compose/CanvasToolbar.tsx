'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Download, ImagePlus } from 'lucide-react';
import { useUpdateFigure } from '@/hooks/useFigures';
import { getPanelExportRegions, resolveExportScale } from '@/lib/domain/export';
import { renderPanels, type PanelFile } from '@/lib/export/stage-export';
import { toast } from 'sonner';
import type { Figure, Surface } from '@/types/database';
import type Konva from 'konva';

interface CanvasToolbarProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  /** Seams, dead zones and buffers — editor guides that must never be printed. */
  overlayRef: React.RefObject<Konva.Layer | null>;
  selectedId: string | null;
  figures: Figure[];
  surface: Surface;
  projectId: string;
  /** The saved background has not painted onto the stage yet. */
  backgroundPending: boolean;
  onBackgroundUpload: (file: File) => void;
}

/** How far to back off, and how often, when the browser refuses an allocation
 *  we thought was legal — a 2m wall at 200 DPI is ~230M pixels, and the ceiling
 *  that actually applies depends on the browser and the machine's memory. */
const BROWSER_RETRY_FACTOR = 0.6;
const MAX_EXPORT_ATTEMPTS = 4;
/** Browsers drop downloads fired back to back; give each one room to start. */
const DOWNLOAD_GAP_MS = 400;

export function CanvasToolbar({
  stageRef,
  overlayRef,
  selectedId,
  figures,
  surface,
  projectId,
  backgroundPending,
  onBackgroundUpload,
}: CanvasToolbarProps) {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const updateFigure = useUpdateFigure(projectId);
  const selectedFigure = figures.find((f) => f.id === selectedId);

  function moveLayer(direction: 'up' | 'down') {
    if (!selectedFigure) return;
    const newDepth =
      direction === 'up' ? selectedFigure.z_depth + 1 : Math.max(0, selectedFigure.z_depth - 1);
    updateFigure.mutate({ id: selectedFigure.id, data: { z_depth: newDepth } });
  }

  function downloadPanel(file: PanelFile, panelCount: number, dpi: number) {
    const url = URL.createObjectURL(file.blob);
    const name =
      panelCount > 1
        ? `printcraft-panel-${file.index + 1}of${panelCount}-${dpi}dpi.png`
        : `printcraft-composition-${dpi}dpi.png`;
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPng() {
    const stage = stageRef.current;
    if (!stage || isExporting) return;

    // Exporting now would print the bare canvas and still report success —
    // the scene would be missing from a file nobody re-checks before printing.
    if (backgroundPending) {
      toast.error('The background is still loading — exporting now would print without the scene.');
      return;
    }

    // One sheet per physical panel — that is what gets printed and trimmed.
    const regions = getPanelExportRegions({
      panels: surface.panels,
      bleedMm: surface.bleed_mm,
      dpi: surface.dpi_target,
      stageWidth: stage.width(),
      stageHeight: stage.height(),
    });

    if (regions.length === 0) {
      toast.error('The canvas has not been measured yet — try again in a moment.');
      return;
    }

    // Every sheet has to come out at the same DPI, so the largest panel sets
    // the scale for all of them.
    const binding = regions.reduce((widest, region) =>
      Math.max(region.stage.width, region.stage.height) >
      Math.max(widest.stage.width, widest.stage.height)
        ? region
        : widest,
    );
    const scaleArgs = {
      canvasWidth: binding.stage.width,
      canvasHeight: binding.stage.height,
      targetWidthPx: binding.output.width_px,
      targetDpi: surface.dpi_target,
    };

    setIsExporting(true);
    // The guide layer is editor chrome, not artwork — a red seam line printed
    // onto a 2m glass wall ruins the piece (Ground Truth #5). Konva's stage
    // export skips layers that are not visible.
    overlayRef.current?.hide();

    try {
      let scale = resolveExportScale(scaleArgs);
      let files: PanelFile[] | null = null;

      for (let attempt = 0; attempt < MAX_EXPORT_ATTEMPTS && !files; attempt++) {
        if (attempt > 0) {
          scale = resolveExportScale({
            ...scaleArgs,
            maxPixelRatio: scale.pixelRatio * BROWSER_RETRY_FACTOR,
          });
        }
        files = await renderPanels(stage, regions, scale.pixelRatio);
      }

      if (!files) {
        toast.error('Export failed — your browser could not allocate a canvas this large.');
        return;
      }

      for (const [i, file] of files.entries()) {
        if (i > 0) await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_GAP_MS));
        downloadPanel(file, files.length, scale.dpi);
      }

      if (scale.limitedBy !== 'none') {
        toast.warning(
          `Exported at ${scale.dpi} DPI — under the ${surface.dpi_target} DPI target because your browser caps canvas size.`,
        );
      } else if (files.length > 1) {
        toast.success(
          `Print-ready — ${files.length} panel files at ${scale.dpi} DPI, bleed included`,
        );
      } else {
        const size = `${Math.round(binding.stage.width * scale.pixelRatio)} x ${Math.round(binding.stage.height * scale.pixelRatio)} px`;
        toast.success(`Print-ready PNG — ${size} at ${scale.dpi} DPI`);
      }
    } finally {
      overlayRef.current?.show();
      setIsExporting(false);
    }
  }

  function handleBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onBackgroundUpload(file);
  }

  return (
    <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl glass-strong border border-white/[0.06] shadow-xl shadow-black/20 flex-wrap justify-center">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full h-8 text-xs sm:text-sm"
        disabled={!selectedId}
        onClick={() => moveLayer('up')}
      >
        <ArrowUp className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Forward</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full h-8 text-xs sm:text-sm"
        disabled={!selectedId}
        onClick={() => moveLayer('down')}
      >
        <ArrowDown className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Back</span>
      </Button>

      <div className="h-5 w-px bg-white/[0.08] mx-0.5 sm:mx-1" />

      <Button
        variant="outline"
        size="sm"
        className="rounded-full h-8 text-xs sm:text-sm"
        disabled={backgroundPending}
        onClick={() => bgInputRef.current?.click()}
      >
        <ImagePlus className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">{backgroundPending ? 'Saving...' : 'Background'}</span>
      </Button>
      <input
        ref={bgInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleBgFileChange}
      />

      <Button
        variant="default"
        size="sm"
        className="rounded-full h-8 text-xs sm:text-sm"
        onClick={handleExportPng}
        disabled={isExporting || backgroundPending}
      >
        <Download className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">
          {isExporting ? 'Exporting...' : `Export ${surface.dpi_target} DPI`}
        </span>
      </Button>

      {selectedFigure && (
        <>
          <div className="h-5 w-px bg-white/[0.08] mx-0.5 sm:mx-1 hidden sm:block" />
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {selectedFigure.label ?? 'Unnamed figure'}
          </span>
        </>
      )}
    </div>
  );
}
