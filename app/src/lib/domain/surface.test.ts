/**
 * Surface geometry is the constraint this product says it cannot relax.
 *
 * CLAUDE.md, design principle 6: "Dead zones are sacred. The system physically
 * prevents placing a face on a seam line. This isn't a suggestion — it's a
 * constraint." Red flag 6: "A face split by a glass seam ruins the entire
 * artwork. This is not optional."
 *
 * Nothing executed any of it. `verify` was lint + typecheck and there was no
 * test script in either package.json. Every failure here is expensive in a way
 * software failures usually are not: the output is printed onto physical glass
 * at 200 DPI. You cannot patch a shower wall.
 */
import { describe, expect, it } from 'vitest'
import {
  cmToPixels,
  getPanelBounds,
  getSeamPositionsFromPanels,
  getTotalDimensions,
  isInDeadZone,
  checkPlacement,
  canvasRectToSurfaceCm,
  SEAM_BUFFER_CM,
  isNearSeam,
  pixelsToCm,
} from './surface'
import { SURFACE_PRESETS } from '@/lib/config/surface-presets'

describe('SURFACE_PRESETS agree with the geometry derived from their panels', () => {
  // The most dangerous drift in this repo. A preset states its seams TWICE —
  // once implicitly, as panel widths, and once explicitly in `seam_positions`.
  // If those disagree, the composition editor draws the seam guide somewhere
  // the real glass join is not, and a face gets printed across it. The two
  // representations must be one truth.
  for (const preset of SURFACE_PRESETS) {
    it(`"${preset.id}" declares the seams its panels actually produce`, () => {
      expect(preset.seam_positions).toEqual(getSeamPositionsFromPanels(preset.panels))
    })

    it(`"${preset.id}" keeps every dead zone inside the surface`, () => {
      // A dead zone off the edge silently protects nothing: the overlap test
      // can never match, so the "sacred" fixture area stops being enforced.
      const { width_cm, height_cm } = getTotalDimensions(preset.panels)
      for (const zone of preset.dead_zones) {
        expect(zone.x_cm).toBeGreaterThanOrEqual(0)
        expect(zone.y_cm).toBeGreaterThanOrEqual(0)
        expect(zone.x_cm + zone.width_cm).toBeLessThanOrEqual(width_cm)
        expect(zone.y_cm + zone.height_cm).toBeLessThanOrEqual(height_cm)
      }
    })

    it(`"${preset.id}" has usable print parameters`, () => {
      expect(preset.panels.length).toBeGreaterThan(0)
      for (const panel of preset.panels) {
        expect(panel.width_cm).toBeGreaterThan(0)
        expect(panel.height_cm).toBeGreaterThan(0)
      }
      expect(preset.dpi_target).toBeGreaterThanOrEqual(150)
      expect(preset.bleed_mm).toBeGreaterThanOrEqual(0)
    })
  }

  it('has unique preset ids', () => {
    const ids = SURFACE_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('getSeamPositionsFromPanels', () => {
  it('places a seam at every internal panel boundary', () => {
    expect(getSeamPositionsFromPanels([{ width_cm: 77.5, height_cm: 190 }, { width_cm: 119.5, height_cm: 190 }]))
      .toEqual([{ x_cm: 77.5 }])
  })

  it('returns no seam for a single panel', () => {
    expect(getSeamPositionsFromPanels([{ width_cm: 100, height_cm: 70 }])).toEqual([])
  })

  it('accumulates across three panels rather than repeating the first width', () => {
    expect(
      getSeamPositionsFromPanels([
        { width_cm: 50, height_cm: 100 },
        { width_cm: 60, height_cm: 100 },
        { width_cm: 70, height_cm: 100 },
      ]),
    ).toEqual([{ x_cm: 50 }, { x_cm: 110 }])
  })
})

describe('getPanelBounds', () => {
  it('tiles the surface with no gap and no overlap', () => {
    const panels = [
      { width_cm: 77.5, height_cm: 190 },
      { width_cm: 119.5, height_cm: 190 },
    ]
    const bounds = getPanelBounds(panels)
    expect(bounds[0].x_cm).toBe(0)
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i].x_cm).toBeCloseTo(bounds[i - 1].x_cm + bounds[i - 1].width_cm, 10)
    }
    const end = bounds.at(-1)!
    expect(end.x_cm + end.width_cm).toBeCloseTo(getTotalDimensions(panels).width_cm, 10)
  })
})

describe('getTotalDimensions', () => {
  it('sums widths and takes the tallest panel', () => {
    expect(
      getTotalDimensions([
        { width_cm: 77.5, height_cm: 190 },
        { width_cm: 119.5, height_cm: 180 },
      ]),
    ).toEqual({ width_cm: 197, height_cm: 190 })
  })
})

describe('isInDeadZone', () => {
  const fixture = [{ x_cm: 18.75, y_cm: 0, width_cm: 40, height_cm: 45, reason: 'Dusch Armatur' }]

  it('catches a figure overlapping the fixture zone', () => {
    expect(isInDeadZone(20, 10, 30, 30, fixture)).toBe(fixture[0])
  })

  it('allows a figure entirely clear of it', () => {
    expect(isInDeadZone(100, 100, 20, 20, fixture)).toBeNull()
  })

  it('treats mere edge contact as clear, not as overlap', () => {
    // Exactly abutting the right edge of the zone. The comparison is strict
    // (`x_cm + width_cm > zone.x_cm`), so touching is allowed — pinned because
    // flipping it to >= would suddenly reject legitimate placements that sit
    // flush against a fixture.
    expect(isInDeadZone(58.75, 0, 10, 10, fixture)).toBeNull()
    expect(isInDeadZone(8.75, 0, 10, 10, fixture)).toBeNull()
  })

  it('catches a figure that fully contains the zone', () => {
    expect(isInDeadZone(0, 0, 200, 200, fixture)).toBe(fixture[0])
  })

  it('is clear when there are no dead zones', () => {
    expect(isInDeadZone(0, 0, 10, 10, [])).toBeNull()
  })
})

describe('isNearSeam', () => {
  const seams = [{ x_cm: 77.5 }]

  it('rejects a figure straddling the seam', () => {
    expect(isNearSeam(70, 20, seams)).toBe(true)
  })

  it('rejects a figure inside the default 10cm buffer', () => {
    expect(isNearSeam(69, 5, seams)).toBe(true) // right edge 74, within 67.5..87.5
  })

  it('allows a figure clear of the buffer', () => {
    expect(isNearSeam(0, 60, seams)).toBe(false) // right edge 60 < 67.5
    expect(isNearSeam(90, 20, seams)).toBe(false) // left edge 90 > 87.5
  })

  it('honours a custom buffer', () => {
    expect(isNearSeam(0, 60, seams, 20)).toBe(true) // buffer widens to 57.5
  })

  it('is false when the surface has no seams', () => {
    expect(isNearSeam(0, 1000, [])).toBe(false)
  })
})

describe('cm <-> pixel conversion', () => {
  it('converts at the stated DPI', () => {
    expect(cmToPixels(2.54, 300)).toBe(300)
    expect(pixelsToCm(300, 300)).toBeCloseTo(2.54, 10)
  })

  it('round-trips within rounding error', () => {
    // cmToPixels rounds to whole pixels, so the trip back is not exact — but it
    // must stay under half a pixel, or export dimensions drift from the spec
    // sheet handed to the print shop.
    for (const cm of [10, 77.5, 119.5, 190]) {
      const back = pixelsToCm(cmToPixels(cm, 200), 200)
      expect(Math.abs(back - cm)).toBeLessThan(pixelsToCm(0.5, 200))
    }
  })

  it('produces the real Duschwand pixel size at its print DPI', () => {
    // 197cm x 190cm at 200 DPI — the actual first client artwork.
    const { width_cm, height_cm } = getTotalDimensions(SURFACE_PRESETS[0].panels)
    expect(cmToPixels(width_cm, 200)).toBe(15512)
    expect(cmToPixels(height_cm, 200)).toBe(14961)
  })
})


/**
 * The rule above was implemented and tested, then called by nothing: the editor
 * drew the red zones as decoration and let any figure sit on top of them. These
 * cover the wiring — the rule the canvas actually asks, and the frame change it
 * has to make first.
 */
describe('checkPlacement', () => {
  const fixture = { x_cm: 18.75, y_cm: 0, width_cm: 40, height_cm: 45, reason: 'Dusch Armatur' }
  const seams = [{ x_cm: 77.5 }]

  it('lets a figure stand on clear glass', () => {
    expect(
      checkPlacement({
        rect: { x_cm: 100, y_cm: 60, width_cm: 30, height_cm: 80 },
        deadZones: [fixture],
        seams,
      })
    ).toBeNull()
  })

  it('names the fixture a figure would be lost behind', () => {
    expect(
      checkPlacement({
        rect: { x_cm: 20, y_cm: 10, width_cm: 30, height_cm: 40 },
        deadZones: [fixture],
        seams: [],
      })
    ).toEqual({ kind: 'dead-zone', reason: 'Dusch Armatur' })
  })

  it('refuses the seam band, where a face would be cut in half', () => {
    const violation = checkPlacement({
      rect: { x_cm: 70, y_cm: 100, width_cm: 20, height_cm: 40 },
      deadZones: [],
      seams,
    })

    expect(violation?.kind).toBe('seam')
  })

  it('reports the dead zone first when a figure breaks both rules', () => {
    // Overlaps the fixture AND reaches into the seam band.
    const violation = checkPlacement({
      rect: { x_cm: 40, y_cm: 10, width_cm: 40, height_cm: 40 },
      deadZones: [fixture],
      seams,
    })

    expect(violation).toEqual({ kind: 'dead-zone', reason: 'Dusch Armatur' })
  })

  it('honours the buffer the editor draws', () => {
    const justOutside = checkPlacement({
      rect: { x_cm: 77.5 - SEAM_BUFFER_CM - 5, y_cm: 100, width_cm: 5, height_cm: 40 },
      deadZones: [],
      seams,
    })
    const justInside = checkPlacement({
      rect: { x_cm: 77.5 - SEAM_BUFFER_CM + 1, y_cm: 100, width_cm: 5, height_cm: 40 },
      deadZones: [],
      seams,
    })

    expect(justOutside).toBeNull()
    expect(justInside?.kind).toBe('seam')
  })
})

describe('canvasRectToSurfaceCm', () => {
  const canvas = { canvasWidth: 200, canvasHeight: 100, totalWidthCm: 400, totalHeightCm: 200 }

  it('converts a centred figure to its footprint on the surface', () => {
    expect(
      canvasRectToSurfaceCm({ centerXPx: 100, centerYPx: 50, widthPx: 20, heightPx: 10, ...canvas })
    ).toEqual({ x_cm: 180, y_cm: 90, width_cm: 40, height_cm: 20 })
  })

  it('flips y: the top of the canvas is the top of the wall, not the bottom', () => {
    // A figure hugging the top of the canvas stands high on the wall.
    const high = canvasRectToSurfaceCm({ centerXPx: 100, centerYPx: 5, widthPx: 20, heightPx: 10, ...canvas })
    // One hugging the bottom of the canvas sits on the floor.
    const low = canvasRectToSurfaceCm({ centerXPx: 100, centerYPx: 95, widthPx: 20, heightPx: 10, ...canvas })

    // y_cm is the figure's bottom edge: a 20cm-tall figure whose top touches
    // the 200cm ceiling stands with its feet at 180cm.
    expect(high.y_cm).toBe(180)
    expect(high.y_cm + high.height_cm).toBe(200)
    expect(low.y_cm).toBe(0)
  })

  it('catches a figure over the shower fixture, which sits low on the wall', () => {
    const duschwand = { canvasWidth: 197, canvasHeight: 190, totalWidthCm: 197, totalHeightCm: 190 }
    const fixture = { x_cm: 18.75, y_cm: 0, width_cm: 40, height_cm: 45, reason: 'Dusch Armatur' }

    // Near the BOTTOM of the canvas -> low on the wall -> over the fixture.
    const overFixture = canvasRectToSurfaceCm({
      centerXPx: 38, centerYPx: 170, widthPx: 30, heightPx: 40, ...duschwand,
    })
    // Same column, near the TOP of the canvas -> high on the wall -> clear.
    const aboveFixture = canvasRectToSurfaceCm({
      centerXPx: 38, centerYPx: 30, widthPx: 30, heightPx: 40, ...duschwand,
    })

    expect(checkPlacement({ rect: overFixture, deadZones: [fixture], seams: [] })?.kind).toBe('dead-zone')
    expect(checkPlacement({ rect: aboveFixture, deadZones: [fixture], seams: [] })).toBeNull()
  })
})
