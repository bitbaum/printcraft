import { describe, it, expect } from 'vitest'
import {
  calculateExportDimensions,
  resolveExportScale,
  getPanelExportRegions,
  MAX_CANVAS_DIMENSION_PX,
} from './export'
import { SURFACE_PRESETS } from '@/lib/config/surface-presets'

const duschwand = SURFACE_PRESETS.find(p => p.id === 'shower-2-panel')!

describe('resolveExportScale', () => {
  it('scales the on-screen canvas up to the surface print spec', () => {
    const scale = resolveExportScale({
      canvasWidth: 900,
      canvasHeight: 868,
      targetWidthPx: 9000,
      targetDpi: 200,
    })

    expect(scale.pixelRatio).toBe(10)
    expect(scale.width_px).toBe(9000)
    expect(scale.dpi).toBe(200)
    expect(scale.limitedBy).toBe('none')
  })

  it('reaches full target DPI for the Duschwand — the real project this ships for', () => {
    const dims = calculateExportDimensions(
      duschwand.panels,
      duschwand.dpi_target,
      duschwand.bleed_mm
    )
    // Canvas keeps the surface aspect ratio (see CompositionCanvas).
    const canvasWidth = 900
    const canvasHeight = Math.round(canvasWidth * (dims.total_height_px / dims.total_width_px))

    const scale = resolveExportScale({
      canvasWidth,
      canvasHeight,
      targetWidthPx: dims.total_width_px,
      targetDpi: duschwand.dpi_target,
    })

    expect(scale.limitedBy).toBe('none')
    expect(scale.dpi).toBe(duschwand.dpi_target)
    expect(scale.width_px).toBe(dims.total_width_px)
  })

  it('never exceeds the browser canvas ceiling', () => {
    const scale = resolveExportScale({
      canvasWidth: 1200,
      canvasHeight: 1200,
      targetWidthPx: 60_000,
      targetDpi: 300,
    })

    expect(scale.width_px).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX)
    expect(scale.height_px).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX)
    expect(scale.limitedBy).toBe('dimension')
  })

  it('reports the DPI it actually achieved when the ceiling caps the export', () => {
    const scale = resolveExportScale({
      canvasWidth: 1000,
      canvasHeight: 1000,
      targetWidthPx: 32_000, // 2x beyond the dimension ceiling
      targetDpi: 300,
    })

    expect(scale.limitedBy).toBe('dimension')
    expect(scale.dpi).toBeLessThan(300)
    // Achieved DPI must match achieved pixels, or the number is a lie.
    expect(scale.dpi).toBe(Math.round((scale.width_px / 32_000) * 300))
  })

  it('measures the lopsided canvas by its longest side', () => {
    const scale = resolveExportScale({
      canvasWidth: 4000,
      canvasHeight: 200,
      targetWidthPx: 40_000,
      targetDpi: 200,
    })

    expect(scale.limitedBy).toBe('dimension')
    expect(scale.width_px).toBe(MAX_CANVAS_DIMENSION_PX)
  })

  it('re-resolves below a ratio the browser refused, and says the browser did it', () => {
    const first = resolveExportScale({
      canvasWidth: 900,
      canvasHeight: 868,
      targetWidthPx: 9000,
      targetDpi: 200,
    })
    expect(first.limitedBy).toBe('none')

    const retry = resolveExportScale({
      canvasWidth: 900,
      canvasHeight: 868,
      targetWidthPx: 9000,
      targetDpi: 200,
      maxPixelRatio: first.pixelRatio * 0.5,
    })

    expect(retry.pixelRatio).toBe(first.pixelRatio * 0.5)
    expect(retry.dpi).toBe(100)
    expect(retry.limitedBy).toBe('browser')
  })

  it('downscales rather than padding when the canvas is larger than the target', () => {
    const scale = resolveExportScale({
      canvasWidth: 2000,
      canvasHeight: 1000,
      targetWidthPx: 1000,
      targetDpi: 150,
    })

    expect(scale.pixelRatio).toBe(0.5)
    expect(scale.dpi).toBe(150)
    expect(scale.limitedBy).toBe('none')
  })

  it('stays safe on a canvas that has not been measured yet', () => {
    const scale = resolveExportScale({
      canvasWidth: 0,
      canvasHeight: 0,
      targetWidthPx: 9000,
      targetDpi: 200,
    })

    expect(scale.pixelRatio).toBeGreaterThan(0)
    expect(Number.isNaN(scale.dpi)).toBe(false)
  })
})

describe('calculateExportDimensions', () => {
  it('adds bleed on both edges of the full artwork', () => {
    const dims = calculateExportDimensions([{ width_cm: 100, height_cm: 70 }], 200, 5)

    // 100cm + 2x5mm bleed = 101cm -> 101/2.54*200
    expect(dims.total_width_px).toBe(Math.round((101 / 2.54) * 200))
    expect(dims.total_height_px).toBe(Math.round((71 / 2.54) * 200))
  })

  it('gives every panel its own bleed so each printed sheet can be trimmed', () => {
    const dims = calculateExportDimensions(duschwand.panels, duschwand.dpi_target, duschwand.bleed_mm)

    expect(dims.panels).toHaveLength(duschwand.panels.length)
    for (const panel of dims.panels) {
      expect(panel.width_px).toBeGreaterThan(0)
      expect(panel.height_px).toBeGreaterThan(0)
    }
    // Panel 2 starts where panel 1's physical edge is, not at zero.
    expect(dims.panels[1].x_px).toBe(Math.round((duschwand.panels[0].width_cm / 2.54) * duschwand.dpi_target))
  })
})

describe('getPanelExportRegions', () => {
  // The composition canvas keeps the surface aspect ratio, so a stage unit is a
  // fixed number of cm on both axes.
  const stageFor = (widthCm: number, heightCm: number, stageWidth: number) => ({
    stageWidth,
    stageHeight: stageWidth * (heightCm / widthCm),
  })

  it('gives every panel its own sheet at the target DPI', () => {
    const regions = getPanelExportRegions({
      panels: duschwand.panels,
      bleedMm: duschwand.bleed_mm,
      dpi: duschwand.dpi_target,
      ...stageFor(197, 190, 900),
    })

    expect(regions).toHaveLength(2)
    for (const [i, region] of regions.entries()) {
      const panelWidthCm = duschwand.panels[i].width_cm + duschwand.bleed_mm / 5
      expect(region.output.width_px).toBe(Math.round((panelWidthCm / 2.54) * duschwand.dpi_target))
      expect(region.output.height_px).toBe(Math.round((190.6 / 2.54) * duschwand.dpi_target))
    }
  })

  it('keeps every panel under the canvas ceiling that the whole wall approaches', () => {
    const regions = getPanelExportRegions({
      panels: duschwand.panels,
      bleedMm: duschwand.bleed_mm,
      dpi: duschwand.dpi_target,
      ...stageFor(197, 190, 900),
    })

    const whole = calculateExportDimensions(duschwand.panels, duschwand.dpi_target, duschwand.bleed_mm)
    const panelArea = Math.max(...regions.map(r => r.output.width_px * r.output.height_px))

    expect(panelArea).toBeLessThan(whole.total_width_px * whole.total_height_px)
    for (const region of regions) {
      expect(region.output.width_px).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX)
      expect(region.output.height_px).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX)
    }
  })

  it('takes the bleed at a seam from the neighbouring panel, so the scene stays continuous', () => {
    const { stageWidth, stageHeight } = stageFor(197, 190, 900)
    const regions = getPanelExportRegions({
      panels: duschwand.panels,
      bleedMm: duschwand.bleed_mm,
      dpi: duschwand.dpi_target,
      stageWidth,
      stageHeight,
    })

    // The inner edges sit inside the artwork: real pixels, nothing to invent.
    expect(regions[0].outside.right).toBe(0)
    expect(regions[1].outside.left).toBe(0)
    // And the two crops overlap by exactly two bleeds across the seam.
    const overlap = regions[0].stage.x + regions[0].stage.width - regions[1].stage.x
    const bleedInStageUnits = (duschwand.bleed_mm / 10) * (stageWidth / 197)
    expect(overlap).toBeCloseTo(bleedInStageUnits * 2, 6)
  })

  it('flags the outer edges, where bleed has no artwork behind it', () => {
    const { stageWidth, stageHeight } = stageFor(197, 190, 900)
    const regions = getPanelExportRegions({
      panels: duschwand.panels,
      bleedMm: duschwand.bleed_mm,
      dpi: duschwand.dpi_target,
      stageWidth,
      stageHeight,
    })
    const bleedInStageUnits = (duschwand.bleed_mm / 10) * (stageWidth / 197)

    expect(regions[0].outside.left).toBeCloseTo(bleedInStageUnits, 6)
    expect(regions[1].outside.right).toBeCloseTo(bleedInStageUnits, 6)
    for (const region of regions) {
      expect(region.outside.top).toBeGreaterThan(0)
      expect(region.outside.bottom).toBeGreaterThan(0)
    }
  })

  it('sits a shorter panel on the bottom edge, where it physically stands', () => {
    const regions = getPanelExportRegions({
      panels: [{ width_cm: 100, height_cm: 200 }, { width_cm: 100, height_cm: 150 }],
      bleedMm: 0,
      dpi: 200,
      stageWidth: 200,
      stageHeight: 200,
    })

    expect(regions[0].stage.y).toBe(0)
    expect(regions[0].stage.height).toBe(200)
    // 50cm shorter on a 200cm surface drawn 200 units tall -> starts 50 units down.
    expect(regions[1].stage.y).toBe(50)
    expect(regions[1].stage.height).toBe(150)
  })

  it('covers the whole artwork with no gap between panels', () => {
    const regions = getPanelExportRegions({
      panels: [{ width_cm: 50, height_cm: 100 }, { width_cm: 50, height_cm: 100 }],
      bleedMm: 0,
      dpi: 200,
      stageWidth: 100,
      stageHeight: 100,
    })

    expect(regions[0].stage.x).toBe(0)
    expect(regions[0].stage.x + regions[0].stage.width).toBe(regions[1].stage.x)
    expect(regions[1].stage.x + regions[1].stage.width).toBe(100)
  })

  it('returns nothing rather than a broken crop for an unmeasured stage', () => {
    expect(
      getPanelExportRegions({
        panels: duschwand.panels,
        bleedMm: 3,
        dpi: 200,
        stageWidth: 0,
        stageHeight: 0,
      })
    ).toEqual([])
  })
})
