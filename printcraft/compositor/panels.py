"""Split a unified mural into per-panel print files.

A multi-panel surface (like the Duschwand corner: 80cm + 120cm = 200cm total)
needs one file per panel so the print shop can produce them separately.

We slice the source image at the panel boundaries in pixel-space.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional
from PIL import Image

from printcraft.project import Surface, Panel
from printcraft.compositor.upscale import reflect_expand


def split_into_panels(
    img: Image.Image,
    surface: Surface,
) -> list[tuple[Panel, Image.Image]]:
    """Split a unified image into per-panel crops, bled on all four edges.

    Bleed comes from the neighbouring panel wherever there is one — that keeps
    the artwork continuous across a seam. At the mural's outer boundary there is
    no neighbour, so the edge is mirrored outward instead. The previous version
    clamped those edges to the image, which silently produced files with no
    bleed at the top, the bottom, and the two outer sides: the print shop trims
    to the panel size, and any drift there exposes unprinted material.

    Bleed is read from the surface (`surface.bleed_mm`) rather than passed in,
    so it cannot disagree with what the project asked the shop for.

    Args:
        img: The full unwrapped mural, already at surface total dimensions.
        surface: Surface definition (panels in order, left-to-right).

    Returns:
        List of (panel, image) tuples in the same order as surface.panels. Each
        image is (panel width + 2×bleed) × (panel height + 2×bleed).

    Raises:
        ValueError: if img dimensions don't match surface.total_pixels() closely.
    """
    total_w, total_h = surface.total_pixels()
    if abs(img.size[0] - total_w) > 5 or abs(img.size[1] - total_h) > 5:
        raise ValueError(
            f"Image size {img.size} doesn't match surface total {total_w}×{total_h}. "
            f"Upscale first."
        )

    dpi = surface.dpi
    bleed_px = surface.bleed_px()

    result = []
    x_cursor = 0
    for panel in surface.panels:
        panel_w, panel_h = panel.pixels(dpi)

        # Take as much real neighbouring artwork as exists...
        left = max(0, x_cursor - bleed_px)
        right = min(img.size[0], x_cursor + panel_w + bleed_px)
        top = max(0, -bleed_px)
        bottom = min(img.size[1], panel_h + bleed_px)
        cropped = img.crop((left, top, right, bottom))

        # ...and mirror the panel's own edge for whatever the mural could not
        # supply, so every file ends up with the full bleed on all four sides.
        cropped = reflect_expand(
            cropped,
            left=bleed_px - (x_cursor - left),
            top=bleed_px - (0 - top),
            right=bleed_px - (right - (x_cursor + panel_w)),
            bottom=bleed_px - (bottom - panel_h),
        )
        result.append((panel, cropped))

        x_cursor += panel_w

    return result


def save_panel(
    panel: Panel,
    img: Image.Image,
    output_dir: Path,
    format: str = "png",
    dpi: int = 150,
) -> Path:
    """Save a panel image with DPI metadata for the print shop."""
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"panel-{panel.id}-{panel.width_cm}x{panel.height_cm}cm.{format}"

    save_kwargs: dict = {"dpi": (dpi, dpi)}
    if format == "jpg" or format == "jpeg":
        save_kwargs["quality"] = 95
        save_kwargs["optimize"] = True
    elif format == "png":
        save_kwargs["optimize"] = True
    elif format == "tiff":
        save_kwargs["compression"] = "tiff_lzw"

    img.save(out_path, **save_kwargs)
    return out_path
