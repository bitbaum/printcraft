import { cmToPixels, getTotalDimensions, getPanelBounds } from './surface';
import type { Panel } from '@/types/database';

/**
 * Browser 2D-canvas ceiling. Konva rasterises the whole stage into one canvas
 * at `pixelRatio`, so a print-spec export can ask for more than the browser
 * will allocate — it then throws or hands back a blank image. 16384 is the
 * conservative desktop floor (Chrome allows more, Firefox's stricter *area*
 * limit varies), so it is a bound we can apply up front; a browser that still
 * refuses is handled empirically by retrying with `maxPixelRatio`.
 */
export const MAX_CANVAS_DIMENSION_PX = 16384;

export interface ExportDimensions {
  total_width_px: number;
  total_height_px: number;
  panels: { index: number; x_px: number; y_px: number; width_px: number; height_px: number }[];
}

export function calculateExportDimensions(
  panels: Panel[],
  dpi: number,
  bleedMm: number,
): ExportDimensions {
  const bleedCm = bleedMm / 10;
  const bounds = getPanelBounds(panels);
  const { width_cm, height_cm } = getTotalDimensions(panels);

  const total_width_px = cmToPixels(width_cm + bleedCm * 2, dpi);
  const total_height_px = cmToPixels(height_cm + bleedCm * 2, dpi);

  const panelExports = bounds.map((b, i) => ({
    index: i,
    x_px: cmToPixels(b.x_cm, dpi),
    y_px: 0,
    width_px: cmToPixels(b.width_cm + bleedCm * 2, dpi),
    height_px: cmToPixels(b.height_cm + bleedCm * 2, dpi),
  }));

  return { total_width_px, total_height_px, panels: panelExports };
}

export type ExportLimit = 'none' | 'dimension' | 'browser';

export interface ExportScale {
  /** Multiplier to hand Konva's `pixelRatio`. */
  pixelRatio: number;
  width_px: number;
  height_px: number;
  /** DPI this export actually achieves — equals the target unless limited. */
  dpi: number;
  limitedBy: ExportLimit;
}

/**
 * Work out how far the on-screen canvas must be scaled up to hit the surface's
 * print spec, and how far the browser will actually let us go. Ground Truth #2:
 * the physical object is the product, so an export that quietly lands at a
 * third of the target DPI is a broken artifact, not a smaller one — the caller
 * uses `limitedBy`/`dpi` to say so out loud instead of claiming success.
 *
 * `maxPixelRatio` is the retry path: when a browser refuses an allocation that
 * was within MAX_CANVAS_DIMENSION_PX, the caller re-resolves below the ratio
 * that failed rather than guessing a fixed fallback.
 */
export function resolveExportScale(params: {
  canvasWidth: number;
  canvasHeight: number;
  targetWidthPx: number;
  targetDpi: number;
  maxPixelRatio?: number;
}): ExportScale {
  const { canvasWidth, canvasHeight, targetWidthPx, targetDpi, maxPixelRatio } = params;

  if (canvasWidth <= 0 || canvasHeight <= 0 || targetWidthPx <= 0) {
    return { pixelRatio: 1, width_px: 0, height_px: 0, dpi: 0, limitedBy: 'none' };
  }

  const wanted = targetWidthPx / canvasWidth;
  const dimensionCap = MAX_CANVAS_DIMENSION_PX / Math.max(canvasWidth, canvasHeight);
  const browserCap = maxPixelRatio ?? Infinity;

  const pixelRatio = Math.max(Math.min(wanted, dimensionCap, browserCap), 0);

  let limitedBy: ExportLimit = 'none';
  if (pixelRatio < wanted) {
    limitedBy = browserCap < dimensionCap ? 'browser' : 'dimension';
  }

  return {
    pixelRatio,
    width_px: Math.round(canvasWidth * pixelRatio),
    height_px: Math.round(canvasHeight * pixelRatio),
    dpi: Math.round(targetDpi * (pixelRatio / wanted)),
    limitedBy,
  };
}

export interface PanelExportRegion {
  index: number;
  /**
   * Crop rectangle in stage coordinates. It deliberately reaches outside the
   * stage wherever bleed has no artwork behind it — on inner edges the bleed
   * is real neighbouring content, which is what keeps a scene continuous
   * across a glass seam.
   */
  stage: { x: number; y: number; width: number; height: number };
  /** Size of the printed file at the surface's target DPI. */
  output: { width_px: number; height_px: number };
  /** Stage units of each edge that fall outside the artwork and have no pixels behind them. */
  outside: { left: number; top: number; right: number; bottom: number };
}

/**
 * One crop rectangle per physical panel. Each panel is printed and trimmed as
 * its own sheet (Ground Truth #5), so each needs its own bleed — and cropping
 * per panel is also what keeps a 2m wall under the browser's canvas ceiling,
 * since no single file has to hold the whole surface.
 *
 * Panel y-origin is the bottom edge, matching how dead zones are placed.
 */
export function getPanelExportRegions(params: {
  panels: Panel[];
  bleedMm: number;
  dpi: number;
  stageWidth: number;
  stageHeight: number;
}): PanelExportRegion[] {
  const { panels, bleedMm, dpi, stageWidth, stageHeight } = params;
  const total = getTotalDimensions(panels);

  if (stageWidth <= 0 || stageHeight <= 0 || total.width_cm <= 0 || total.height_cm <= 0) {
    return [];
  }

  const bleedCm = bleedMm / 10;
  const unitsPerCmX = stageWidth / total.width_cm;
  const unitsPerCmY = stageHeight / total.height_cm;

  return getPanelBounds(panels).map((bounds, index) => {
    const widthCm = bounds.width_cm + bleedCm * 2;
    const heightCm = bounds.height_cm + bleedCm * 2;

    const x = (bounds.x_cm - bleedCm) * unitsPerCmX;
    // Panels sit on the bottom edge; a shorter panel leaves the gap at the top.
    const y = (total.height_cm - bounds.height_cm - bleedCm) * unitsPerCmY;
    const width = widthCm * unitsPerCmX;
    const height = heightCm * unitsPerCmY;

    return {
      index,
      stage: { x, y, width, height },
      output: {
        width_px: cmToPixels(widthCm, dpi),
        height_px: cmToPixels(heightCm, dpi),
      },
      outside: {
        left: Math.max(0, -x),
        top: Math.max(0, -y),
        right: Math.max(0, x + width - stageWidth),
        bottom: Math.max(0, y + height - stageHeight),
      },
    };
  });
}
