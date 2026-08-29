import type Konva from 'konva';
import type { PanelExportRegion } from '@/lib/domain/export';

/**
 * Rendering a Konva stage into print files. This is the browser half of the
 * export — the geometry it works from is decided in `lib/domain/export`.
 */

/**
 * Bleed past the outer edge of the artwork has no pixels behind it, so the crop
 * comes back transparent there and a print shop would lay down white on the
 * trim margin. Stretch the outermost row and column across that margin instead:
 * it is a few millimetres that get cut off, and it must not read as a border.
 */
function fillOutsideBleed(
  canvas: HTMLCanvasElement,
  outside: PanelExportRegion['outside'],
  pixelRatio: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Konva leaves its own transform on the context — scaled by pixelRatio and
  // translated to the crop origin. These strips are measured in device pixels,
  // so drop that transform for the duration.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const { width, height } = canvas;
  const left = Math.round(outside.left * pixelRatio);
  const top = Math.round(outside.top * pixelRatio);
  const right = Math.round(outside.right * pixelRatio);
  const bottom = Math.round(outside.bottom * pixelRatio);

  // Copy the first fully-interior row/column, not the boundary one — the edge
  // pixel is antialiased, and stretching it would print a translucent seam.
  // Each strip also covers that boundary pixel, so the trim edge comes out solid.
  // Sides first, then full-width top/bottom, so the corners end up covered too.
  if (left > 0) ctx.drawImage(canvas, left + 1, 0, 1, height, 0, 0, left + 1, height);
  if (right > 0)
    ctx.drawImage(canvas, width - right - 2, 0, 1, height, width - right - 1, 0, right + 1, height);
  if (top > 0) ctx.drawImage(canvas, 0, top + 1, width, 1, 0, 0, width, top + 1);
  if (bottom > 0)
    ctx.drawImage(
      canvas,
      0,
      height - bottom - 2,
      width,
      1,
      0,
      height - bottom - 1,
      width,
      bottom + 1,
    );

  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve));
}

/**
 * Render one panel as a print file. Throws or resolves null when the browser
 * refuses a canvas this large — the caller retries smaller and reports the DPI
 * it actually reached rather than claiming the target.
 */
export async function renderPanel(
  stage: Konva.Stage,
  region: PanelExportRegion,
  pixelRatio: number,
): Promise<Blob | null> {
  const canvas = stage.toCanvas({
    x: region.stage.x,
    y: region.stage.y,
    width: region.stage.width,
    height: region.stage.height,
    pixelRatio,
  });

  fillOutsideBleed(canvas, region.outside, pixelRatio);
  return canvasToBlob(canvas);
}

export interface PanelFile {
  index: number;
  blob: Blob;
}

/** Every panel at one shared scale — a set of sheets must share a DPI. */
export async function renderPanels(
  stage: Konva.Stage,
  regions: PanelExportRegion[],
  pixelRatio: number,
): Promise<PanelFile[] | null> {
  const files: PanelFile[] = [];

  for (const region of regions) {
    let blob: Blob | null = null;
    try {
      blob = await renderPanel(stage, region, pixelRatio);
    } catch {
      return null;
    }
    if (!blob) return null;
    files.push({ index: region.index, blob });
  }

  return files;
}
