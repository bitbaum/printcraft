'use client';

import { use, useState } from 'react';
import { useSurface, useUpsertSurface } from '@/hooks/useSurface';
import { SURFACE_PRESETS, type SurfacePreset } from '@/lib/config/surface-presets';
import { getTotalDimensions, getSeamPositionsFromPanels } from '@/lib/domain/surface';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Plus, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Panel, DeadZone, SurfaceType } from '@/types/database';

export default function SurfacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: existingSurface } = useSurface(id);
  const upsertSurface = useUpsertSurface(id);

  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [surfaceType, setSurfaceType] = useState<SurfaceType>('custom');
  const [panels, setPanels] = useState<Panel[]>([{ width_cm: 100, height_cm: 100 }]);
  const [deadZones, setDeadZones] = useState<DeadZone[]>([]);
  const [dpiTarget, setDpiTarget] = useState(200);
  const [bleedMm, setBleedMm] = useState(3);

  // Hydrate the form once the saved surface loads. Adjusting state during render
  // against a remembered previous value (React "you might not need an effect")
  // avoids the extra render pass an effect-driven setState would cause.
  const [hydratedSurface, setHydratedSurface] = useState(existingSurface);
  if (existingSurface && existingSurface !== hydratedSurface) {
    setHydratedSurface(existingSurface);
    setPanels(existingSurface.panels);
    setDeadZones(existingSurface.dead_zones);
    setDpiTarget(existingSurface.dpi_target);
    setBleedMm(existingSurface.bleed_mm);
    setSurfaceType(existingSurface.type);
  }

  function applyPreset(preset: SurfacePreset) {
    setSelectedPreset(preset.id);
    setSurfaceType(preset.type);
    setPanels([...preset.panels]);
    setDeadZones([...preset.dead_zones]);
    setDpiTarget(preset.dpi_target);
    setBleedMm(preset.bleed_mm);
  }

  function updatePanel(index: number, field: keyof Panel, value: number) {
    const updated = [...panels];
    updated[index] = { ...updated[index], [field]: value };
    setPanels(updated);
  }

  function addPanel() {
    setPanels([...panels, { width_cm: 100, height_cm: panels[0]?.height_cm ?? 100 }]);
  }

  function removePanel(index: number) {
    if (panels.length <= 1) return;
    setPanels(panels.filter((_, i) => i !== index));
  }

  function addDeadZone() {
    setDeadZones([...deadZones, { x_cm: 0, y_cm: 0, width_cm: 40, height_cm: 40, reason: '' }]);
  }

  function updateDeadZone(index: number, field: keyof DeadZone, value: string | number) {
    const updated = [...deadZones];
    updated[index] = { ...updated[index], [field]: value };
    setDeadZones(updated);
  }

  function removeDeadZone(index: number) {
    setDeadZones(deadZones.filter((_, i) => i !== index));
  }

  function handleSave() {
    const seams = getSeamPositionsFromPanels(panels);
    upsertSurface.mutate(
      {
        project_id: id,
        type: surfaceType,
        panels,
        seam_positions: seams,
        dead_zones: deadZones,
        dpi_target: dpiTarget,
        bleed_mm: bleedMm,
      },
      {
        onSuccess: () => toast.success('Surface saved'),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const { width_cm, height_cm } = getTotalDimensions(panels);
  const scale = Math.min(500 / width_cm, 300 / height_cm, 2);

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10 animate-in-page">
      <div>
        <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight">Surface</h2>
        <p className="text-muted-foreground mt-2 text-base sm:text-lg font-light">
          Define the physical surface this artwork will be printed on
        </p>
      </div>

      {/* Presets */}
      <div>
        <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 block">
          Presets
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {SURFACE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={cn(
                'p-3 sm:p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer card-hover',
                selectedPreset === preset.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30 glow-selected'
                  : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]',
              )}
              onClick={() => applyPreset(preset)}
            >
              <p className="text-sm font-medium">{preset.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
              {selectedPreset === preset.id && <Check className="h-4 w-4 text-primary mt-2" />}
            </button>
          ))}
        </div>
      </div>

      <div className="section-divider" />

      {/* Panels */}
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-lg">Panels</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Total: {width_cm.toFixed(1)} x {height_cm.toFixed(1)} cm
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={addPanel}>
            <Plus className="h-3 w-3 mr-1.5" /> Add Panel
          </Button>
        </div>
        {panels.map((panel, i) => (
          <div
            key={i}
            className="flex flex-col sm:flex-row sm:items-end gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
          >
            <div className="flex gap-3 flex-1">
              <div className="space-y-1.5 flex-1 sm:flex-none">
                <Label className="text-xs text-muted-foreground">Width (cm)</Label>
                <Input
                  type="number"
                  value={panel.width_cm}
                  onChange={(e) => updatePanel(i, 'width_cm', parseFloat(e.target.value) || 0)}
                  className="sm:w-28 h-9"
                />
              </div>
              <div className="space-y-1.5 flex-1 sm:flex-none">
                <Label className="text-xs text-muted-foreground">Height (cm)</Label>
                <Input
                  type="number"
                  value={panel.height_cm}
                  onChange={(e) => updatePanel(i, 'height_cm', parseFloat(e.target.value) || 0)}
                  className="sm:w-28 h-9"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">
                Panel {i + 1}
              </Badge>
              {panels.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => removePanel(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="section-divider" />

      {/* Dead Zones */}
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-lg">Dead Zones</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Areas blocked by fixtures (shower head, faucet, etc.)
            </p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={addDeadZone}>
            <Plus className="h-3 w-3 mr-1.5" /> Add Zone
          </Button>
        </div>
        {deadZones.map((zone, i) => (
          <div
            key={i}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">X (cm)</Label>
                <Input
                  type="number"
                  value={zone.x_cm}
                  onChange={(e) => updateDeadZone(i, 'x_cm', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Y (cm)</Label>
                <Input
                  type="number"
                  value={zone.y_cm}
                  onChange={(e) => updateDeadZone(i, 'y_cm', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Width</Label>
                <Input
                  type="number"
                  value={zone.width_cm}
                  onChange={(e) => updateDeadZone(i, 'width_cm', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Height</Label>
                <Input
                  type="number"
                  value={zone.height_cm}
                  onChange={(e) => updateDeadZone(i, 'height_cm', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs text-muted-foreground">Reason</Label>
                <Input
                  value={zone.reason}
                  onChange={(e) => updateDeadZone(i, 'reason', e.target.value)}
                  placeholder="e.g., Shower fixture"
                  className="h-9"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full shrink-0"
                onClick={() => removeDeadZone(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="section-divider" />

      {/* DPI + Bleed */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="space-y-1.5 flex-1 sm:flex-none">
          <Label className="text-xs text-muted-foreground">DPI Target</Label>
          <Input
            type="number"
            value={dpiTarget}
            onChange={(e) => setDpiTarget(parseInt(e.target.value) || 200)}
            className="sm:w-28 h-9"
          />
        </div>
        <div className="space-y-1.5 flex-1 sm:flex-none">
          <Label className="text-xs text-muted-foreground">Bleed (mm)</Label>
          <Input
            type="number"
            value={bleedMm}
            onChange={(e) => setBleedMm(parseFloat(e.target.value) || 0)}
            className="sm:w-28 h-9"
          />
        </div>
      </div>

      {/* Visual Preview */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-white/[0.04]">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Preview
          </h3>
        </div>
        <div className="p-4 sm:p-6 overflow-x-auto">
          <div className="flex items-end gap-0" style={{ height: height_cm * scale }}>
            {panels.map((panel, i) => {
              return (
                <div
                  key={i}
                  className="border border-white/[0.08] relative bg-white/[0.02] rounded-sm"
                  style={{
                    width: panel.width_cm * scale,
                    height: panel.height_cm * scale,
                    borderRight:
                      i < panels.length - 1 ? '2px dashed hsl(var(--destructive))' : undefined,
                  }}
                >
                  <span className="absolute top-2 left-2 text-[10px] text-muted-foreground font-mono">
                    P{i + 1}: {panel.width_cm}x{panel.height_cm}
                  </span>
                  {deadZones.map((zone, zi) => {
                    const panelX = panels.slice(0, i).reduce((s, p) => s + p.width_cm, 0);
                    const zoneRelX = zone.x_cm - panelX;
                    if (zoneRelX < 0 || zoneRelX >= panel.width_cm) return null;
                    return (
                      <div
                        key={zi}
                        className="absolute bg-destructive/15 border border-destructive/40 rounded-sm"
                        style={{
                          left: zoneRelX * scale,
                          bottom: zone.y_cm * scale,
                          width: zone.width_cm * scale,
                          height: zone.height_cm * scale,
                        }}
                      >
                        <span className="text-[8px] text-destructive p-0.5">{zone.reason}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-between pt-4">
        <Button
          size="lg"
          className="rounded-full h-11 px-6"
          onClick={handleSave}
          disabled={upsertSurface.isPending}
        >
          {upsertSurface.isPending
            ? 'Saving...'
            : existingSurface
              ? 'Update Surface'
              : 'Save Surface'}
        </Button>
        {existingSurface && (
          <Link href={`/project/${id}/compose`}>
            <Button variant="outline" size="lg" className="rounded-full h-11 px-6 w-full sm:w-auto">
              Continue to Compose <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
