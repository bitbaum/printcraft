'use client'

import { use } from 'react'
import { useSurface } from '@/hooks/useSurface'
import { useFigures } from '@/hooks/useFigures'
import { calculateExportDimensions } from '@/lib/domain/export'
import { getTotalDimensions } from '@/lib/domain/surface'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Download, AlertCircle, ArrowLeft, Settings2 } from 'lucide-react'
import Link from 'next/link'

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: surface } = useSurface(id)
  const { data: figures } = useFigures(id)

  if (!surface) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-6 animate-in-page">
        <div className="h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
          <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <h2 className="text-xl font-light mb-2">No surface defined</h2>
        <p className="text-muted-foreground mb-6">Define your surface before exporting.</p>
        <Link href={`/project/${id}/surface`}>
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="h-4 w-4 mr-2" /> Go to Surface
          </Button>
        </Link>
      </div>
    )
  }

  const exportDims = calculateExportDimensions(surface.panels, surface.dpi_target, surface.bleed_mm)
  const { width_cm, height_cm } = getTotalDimensions(surface.panels)
  const panelCount = surface.panels.length
  const styledCount = figures?.filter(f => f.styled_url).length ?? 0
  const totalCount = figures?.length ?? 0

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10 animate-in-page">
      <div>
        <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">Export</h2>
        <p className="text-muted-foreground mt-2 text-lg font-light">
          Generate print-ready files for your artwork
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Project Summary</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Surface</span>
            <span className="font-mono text-sm">{width_cm.toFixed(1)} x {height_cm.toFixed(1)} cm ({surface.panels.length} panel{surface.panels.length > 1 ? 's' : ''})</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Figures</span>
            <span>{styledCount} styled / {totalCount} total</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Dead zones</span>
            <span>{surface.dead_zones.length}</span>
          </div>
        </div>
      </div>

      {/* Resolution — owned by the surface, so the file matches the spec that was signed off */}
      <div className="space-y-4">
        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Resolution</Label>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-2xl font-light">{surface.dpi_target} DPI</p>
            <p className="text-sm text-muted-foreground mt-1">
              Set with the surface — the export uses this exact target.
            </p>
          </div>
          <Link href={`/project/${id}/surface`}>
            <Button variant="outline" size="sm" className="rounded-full">
              <Settings2 className="h-4 w-4 mr-2" /> Change on Surface
            </Button>
          </Link>
        </div>
      </div>

      {/* Export dimensions */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Output Dimensions</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Full artwork</span>
            <span className="font-mono">{exportDims.total_width_px} x {exportDims.total_height_px} px</span>
          </div>
          {exportDims.panels.map(panel => (
            <div key={panel.index} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {exportDims.panels.length > 1 ? `Panel ${panel.index + 1} file` : 'File'}
              </span>
              <span className="font-mono">{panel.width_px} x {panel.height_px} px</span>
            </div>
          ))}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bleed</span>
            <span>{surface.bleed_mm} mm</span>
          </div>
        </div>
      </div>

      {styledCount < totalCount && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-5 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            {totalCount - styledCount} figure(s) don&apos;t have styled versions yet. They will use the original photo.
          </p>
        </div>
      )}

      <Link href={`/project/${id}/compose`}>
        <Button className="w-full h-13 text-base font-medium rounded-2xl" size="lg">
          <Download className="h-5 w-5 mr-2" />
          Export {panelCount > 1 ? `${panelCount} panels` : 'PNG'} at {surface.dpi_target} DPI in Compose
        </Button>
      </Link>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {panelCount > 1
          ? `The Compose toolbar downloads one file per panel at ${surface.dpi_target} DPI, each with ${surface.bleed_mm}mm bleed and no seam or dead-zone guides. Bleed at a seam is taken from the neighbouring panel, so the scene stays continuous across the glass.`
          : `The Compose toolbar downloads the artwork at ${surface.dpi_target} DPI with ${surface.bleed_mm}mm bleed and no seam or dead-zone guides.`}
      </p>
    </div>
  )
}
