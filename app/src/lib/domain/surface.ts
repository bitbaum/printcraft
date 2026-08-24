import type { Panel, SeamPosition, DeadZone } from '@/types/database'

/**
 * How close a figure may come to a glass seam. The composition editor draws
 * this band and the placement rule enforces it — one number, not two.
 */
export const SEAM_BUFFER_CM = 10

export function cmToPixels(cm: number, dpi: number): number {
  return Math.round((cm / 2.54) * dpi)
}

export function pixelsToCm(px: number, dpi: number): number {
  return (px * 2.54) / dpi
}

export function getTotalDimensions(panels: Panel[]): { width_cm: number; height_cm: number } {
  const width_cm = panels.reduce((sum, p) => sum + p.width_cm, 0)
  const height_cm = Math.max(...panels.map(p => p.height_cm))
  return { width_cm, height_cm }
}

export function getSeamPositionsFromPanels(panels: Panel[]): SeamPosition[] {
  const seams: SeamPosition[] = []
  let x = 0
  for (let i = 0; i < panels.length - 1; i++) {
    x += panels[i].width_cm
    seams.push({ x_cm: x })
  }
  return seams
}

export function isInDeadZone(
  x_cm: number,
  y_cm: number,
  width_cm: number,
  height_cm: number,
  deadZones: DeadZone[]
): DeadZone | null {
  for (const zone of deadZones) {
    const overlap =
      x_cm < zone.x_cm + zone.width_cm &&
      x_cm + width_cm > zone.x_cm &&
      y_cm < zone.y_cm + zone.height_cm &&
      y_cm + height_cm > zone.y_cm

    if (overlap) return zone
  }
  return null
}

export function isNearSeam(
  x_cm: number,
  width_cm: number,
  seams: SeamPosition[],
  bufferCm: number = SEAM_BUFFER_CM
): boolean {
  for (const seam of seams) {
    const left = x_cm
    const right = x_cm + width_cm
    if (left < seam.x_cm + bufferCm && right > seam.x_cm - bufferCm) {
      return true
    }
  }
  return false
}

export function getPanelBounds(panels: Panel[]): { x_cm: number; width_cm: number; height_cm: number }[] {
  const bounds: { x_cm: number; width_cm: number; height_cm: number }[] = []
  let x = 0
  for (const panel of panels) {
    bounds.push({ x_cm: x, width_cm: panel.width_cm, height_cm: panel.height_cm })
    x += panel.width_cm
  }
  return bounds
}

export interface PlacementRect {
  /** Left edge, cm from the artwork's left edge. */
  x_cm: number
  /** Bottom edge, cm up from the artwork's bottom edge — the frame dead zones use. */
  y_cm: number
  width_cm: number
  height_cm: number
}

export type PlacementViolation =
  | { kind: 'dead-zone'; reason: string }
  | { kind: 'seam'; reason: string }

/**
 * Whether a figure may occupy this patch of the surface, and if not, why.
 *
 * Design principle 6: "Dead zones are sacred. The system physically prevents
 * placing a face on a seam line. This isn't a suggestion — it's a constraint."
 * The rule lives here so the editor never has to decide it, and so a figure
 * that is already stranded in a zone can be told apart from one being dragged
 * into it.
 */
export function checkPlacement(params: {
  rect: PlacementRect
  deadZones: DeadZone[]
  seams: SeamPosition[]
  seamBufferCm?: number
}): PlacementViolation | null {
  const { rect, deadZones, seams, seamBufferCm = SEAM_BUFFER_CM } = params

  const zone = isInDeadZone(rect.x_cm, rect.y_cm, rect.width_cm, rect.height_cm, deadZones)
  if (zone) return { kind: 'dead-zone', reason: zone.reason }

  if (isNearSeam(rect.x_cm, rect.width_cm, seams, seamBufferCm)) {
    return { kind: 'seam', reason: 'glass seam' }
  }

  return null
}

/**
 * Canvas frame (pixels, y down from the top) -> surface frame (cm, y up from
 * the bottom). The editor and the physical surface disagree about which way y
 * runs, and getting that backwards would enforce the constraint against a
 * mirror image of the artwork.
 */
export function canvasRectToSurfaceCm(params: {
  centerXPx: number
  centerYPx: number
  widthPx: number
  heightPx: number
  canvasWidth: number
  canvasHeight: number
  totalWidthCm: number
  totalHeightCm: number
}): PlacementRect {
  const {
    centerXPx, centerYPx, widthPx, heightPx,
    canvasWidth, canvasHeight, totalWidthCm, totalHeightCm,
  } = params

  const cmPerPxX = totalWidthCm / canvasWidth
  const cmPerPxY = totalHeightCm / canvasHeight

  return {
    x_cm: (centerXPx - widthPx / 2) * cmPerPxX,
    y_cm: (canvasHeight - (centerYPx + heightPx / 2)) * cmPerPxY,
    width_cm: widthPx * cmPerPxX,
    height_cm: heightPx * cmPerPxY,
  }
}
