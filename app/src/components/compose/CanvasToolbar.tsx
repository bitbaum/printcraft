'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp, ArrowDown, Download, ImagePlus } from 'lucide-react'
import { useUpdateFigure } from '@/hooks/useFigures'
import { calculateExportDimensions, resolveExportScale } from '@/lib/domain/export'
import { toast } from 'sonner'
import type { Figure, Surface } from '@/types/database'
import type Konva from 'konva'

interface CanvasToolbarProps {
  stageRef: React.RefObject<Konva.Stage | null>
  /** Seams, dead zones and buffers — editor guides that must never be printed. */
  overlayRef: React.RefObject<Konva.Layer | null>
  selectedId: string | null
  figures: Figure[]
  surface: Surface
  projectId: string
  onBackgroundUpload: (file: File) => void
}

/** How far to back off, and how often, when the browser refuses an allocation
 *  we thought was legal — a 2m wall at 200 DPI is ~230M pixels, and the ceiling
 *  that actually applies depends on the browser and the machine's memory. */
const BROWSER_RETRY_FACTOR = 0.6
const MAX_EXPORT_ATTEMPTS = 4

export function CanvasToolbar({ stageRef, overlayRef, selectedId, figures, surface, projectId, onBackgroundUpload }: CanvasToolbarProps) {
  const bgInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const updateFigure = useUpdateFigure(projectId)
  const selectedFigure = figures.find(f => f.id === selectedId)

  function moveLayer(direction: 'up' | 'down') {
    if (!selectedFigure) return
    const newDepth = direction === 'up' ? selectedFigure.z_depth + 1 : Math.max(0, selectedFigure.z_depth - 1)
    updateFigure.mutate({ id: selectedFigure.id, data: { z_depth: newDepth } })
  }

  function downloadBlob(blob: Blob, dpi: number) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `printcraft-composition-${dpi}dpi.png`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportPng() {
    const stage = stageRef.current
    if (!stage || isExporting) return

    const target = calculateExportDimensions(surface.panels, surface.dpi_target, surface.bleed_mm)
    const scaleArgs = {
      canvasWidth: stage.width(),
      canvasHeight: stage.height(),
      targetWidthPx: target.total_width_px,
      targetDpi: surface.dpi_target,
    }

    setIsExporting(true)
    // The guide layer is editor chrome, not artwork — a red seam line printed
    // onto a 2m glass wall ruins the piece (Ground Truth #5). Konva's stage
    // export skips layers that are not visible.
    overlayRef.current?.hide()

    try {
      let scale = resolveExportScale(scaleArgs)
      let blob: Blob | null = null

      for (let attempt = 0; attempt < MAX_EXPORT_ATTEMPTS && !blob; attempt++) {
        if (attempt > 0) {
          scale = resolveExportScale({
            ...scaleArgs,
            maxPixelRatio: scale.pixelRatio * BROWSER_RETRY_FACTOR,
          })
        }
        try {
          blob = (await stage.toBlob({ pixelRatio: scale.pixelRatio })) as Blob | null
        } catch {
          blob = null
        }
      }

      if (!blob) {
        toast.error('Export failed — your browser could not allocate a canvas this large.')
        return
      }

      downloadBlob(blob, scale.dpi)

      const size = `${scale.width_px} x ${scale.height_px} px`
      if (scale.limitedBy === 'none') {
        toast.success(`Print-ready PNG — ${size} at ${scale.dpi} DPI`)
      } else {
        toast.warning(
          `Exported at ${scale.dpi} DPI (${size}) — under the ${surface.dpi_target} DPI target because your browser caps canvas size.`
        )
      }
    } finally {
      overlayRef.current?.show()
      setIsExporting(false)
    }
  }

  function handleBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onBackgroundUpload(file)
  }

  return (
    <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl glass-strong border border-white/[0.06] shadow-xl shadow-black/20 flex-wrap justify-center">
      <Button variant="outline" size="sm" className="rounded-full h-8 text-xs sm:text-sm" disabled={!selectedId} onClick={() => moveLayer('up')}>
        <ArrowUp className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Forward</span>
      </Button>
      <Button variant="outline" size="sm" className="rounded-full h-8 text-xs sm:text-sm" disabled={!selectedId} onClick={() => moveLayer('down')}>
        <ArrowDown className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Back</span>
      </Button>

      <div className="h-5 w-px bg-white/[0.08] mx-0.5 sm:mx-1" />

      <Button variant="outline" size="sm" className="rounded-full h-8 text-xs sm:text-sm" onClick={() => bgInputRef.current?.click()}>
        <ImagePlus className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">Background</span>
      </Button>
      <input ref={bgInputRef} type="file" className="hidden" accept="image/*" onChange={handleBgFileChange} />

      <Button variant="default" size="sm" className="rounded-full h-8 text-xs sm:text-sm" onClick={handleExportPng} disabled={isExporting}>
        <Download className="h-3.5 w-3.5 sm:mr-1.5" />
        <span className="hidden sm:inline">{isExporting ? 'Exporting...' : `Export ${surface.dpi_target} DPI`}</span>
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
  )
}
