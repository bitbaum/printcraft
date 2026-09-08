"""End-to-end delivery pipeline: source → upscale → split panels → export.

`printcraft deliver <project> <source-image>` runs this.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from datetime import datetime

from PIL import Image

from printcraft.project import Project, Panel
from printcraft.compositor.upscale import fit_and_pad, fit_and_crop
from printcraft.compositor.panels import split_into_panels, save_panel


@dataclass
class DeliveryResult:
    project: Project
    source: Path
    full_mural: Optional[Path] = None
    panels: list[Path] = field(default_factory=list)
    manifest: Optional[Path] = None
    notes: list[str] = field(default_factory=list)


def deliver_mural(
    project: Project,
    source_image: str | Path,
    pad_mode: str = "reflect",
    format: str = "png",
) -> DeliveryResult:
    """Produce print-ready deliverables from a source image.

    Steps:
    1. Load source image
    2. Scale to the project's full unwrapped surface dimensions, preserving
       aspect ratio (pad with reflect by default to fill the canvas)
    3. Split into one file per panel, with bleed
    4. Save everything to projects/<name>/deliverables/YYYY-MM-DD-<source>/
    5. Write a manifest.yaml documenting what was produced

    Args:
        project: Loaded Project.
        source_image: Path to the selected mural image (relative or absolute).
        pad_mode: "reflect" | "edge" | "black" | "white" — how to fill unused space
                  when the source aspect doesn't match the surface.
        format: "png" | "jpg" | "tiff" — output format for panels.

    Returns:
        DeliveryResult with paths to everything produced.
    """
    source = Path(source_image)
    if not source.is_absolute():
        source = (project.root / source).resolve()
        if not source.exists():
            # Maybe it's just a filename in rounds/*/outputs/
            matches = list(project.root.rglob(source.name))
            if matches:
                source = matches[0]
    if not source.exists():
        raise FileNotFoundError(f"Source image not found: {source_image}")

    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    out_dir = project.deliverables_dir() / f"{timestamp}-{source.stem}"
    out_dir.mkdir(parents=True, exist_ok=True)

    result = DeliveryResult(project=project, source=source)
    surface = project.surface

    # Step 1: load source
    src = Image.open(source).convert("RGB")
    result.notes.append(f"Source: {source.name} ({src.size[0]}×{src.size[1]} px)")

    # Step 2: scale to surface total dimensions, preserving aspect
    total_w, total_h = surface.total_pixels()
    result.notes.append(f"Target: {total_w}×{total_h} px at {surface.dpi} DPI")
    result.notes.append(f"Bleed: {surface.bleed_mm}mm ({surface.bleed_px()} px) on every panel edge")

    scale_factor = max(total_w / src.size[0], total_h / src.size[1])
    if scale_factor > 8:
        result.notes.append(
            f"⚠ Upscale factor {scale_factor:.1f}x is high. "
            f"LANCZOS resize will be soft — use an AI upscaler (Real-ESRGAN) for production."
        )

    full = fit_and_pad(src, (total_w, total_h), pad_mode=pad_mode)
    full_path = out_dir / f"full-mural-{total_w}x{total_h}.{format}"
    save_kwargs = {"dpi": (surface.dpi, surface.dpi)}
    if format in ("jpg", "jpeg"):
        save_kwargs["quality"] = 95
    full.save(full_path, **save_kwargs)
    result.full_mural = full_path
    result.notes.append(f"Full mural saved: {full_path.name}")

    # Step 3: split into panels
    panel_pairs = split_into_panels(full, surface)
    for panel, panel_img in panel_pairs:
        panel_path = save_panel(panel, panel_img, out_dir, format=format, dpi=surface.dpi)
        result.panels.append(panel_path)
        result.notes.append(
            f"Panel {panel.id}: {panel_img.size[0]}×{panel_img.size[1]} px "
            f"→ {panel_path.name}"
        )

    # Step 4: write manifest
    manifest_path = out_dir / "manifest.yaml"
    manifest_text = _build_manifest(result, surface)
    manifest_path.write_text(manifest_text)
    result.manifest = manifest_path

    return result


def deliver_per_panel(
    project: Project,
    panel_sources: dict[str, str | Path],
    format: str = "png",
    crop_anchor: str = "center",
) -> DeliveryResult:
    """Per-panel delivery: each panel gets its own source image, cropped to fit.

    This is the recommended path when your source image(s) don't match the
    full-unwrapped aspect ratio — rather than padding (which creates visible
    seams), use different images per panel with crop-to-fit.

    Args:
        project: Loaded Project.
        panel_sources: Mapping of panel_id → source image path.
                       Must include an entry for every panel in the surface.
        format: Output format.
        crop_anchor: "center" | "top" | "bottom" | "left" | "right"

    Returns:
        DeliveryResult with per-panel output paths.
    """
    # Validate every panel has a source
    missing = [p.id for p in project.surface.panels if p.id not in panel_sources]
    if missing:
        raise ValueError(f"No source image specified for panels: {missing}")

    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    out_dir = project.deliverables_dir() / f"{timestamp}-per-panel"
    out_dir.mkdir(parents=True, exist_ok=True)

    result = DeliveryResult(project=project, source=Path("<multiple>"))
    result.notes.append(f"Mode: per-panel (each panel from its own source)")
    result.notes.append(f"DPI: {project.surface.dpi}")
    result.notes.append(
        f"Bleed: {project.surface.bleed_mm}mm ({project.surface.bleed_px()} px) on every panel edge"
    )

    for panel in project.surface.panels:
        src_path = Path(panel_sources[panel.id])
        if not src_path.is_absolute():
            resolved = (project.root / src_path).resolve()
            if not resolved.exists():
                matches = list(project.root.rglob(src_path.name))
                if matches:
                    resolved = matches[0]
            src_path = resolved
        if not src_path.exists():
            raise FileNotFoundError(f"Source for panel '{panel.id}' not found: {panel_sources[panel.id]}")

        src_img = Image.open(src_path).convert("RGB")
        pw, ph = panel.pixels(project.surface.dpi)
        # Crop to the trim size PLUS bleed. This path used to crop to exactly
        # (pw, ph) — a file with no bleed at all, which is the one thing a panel
        # handed to a print shop must never be, since trimming drift then
        # exposes unprinted material along the edge.
        bleed = project.surface.bleed_px()
        bled_w, bled_h = pw + 2 * bleed, ph + 2 * bleed

        scale_factor = max(bled_w / src_img.size[0], bled_h / src_img.size[1])
        if scale_factor > 8:
            result.notes.append(
                f"⚠ Panel {panel.id}: upscale {scale_factor:.1f}x from {src_img.size} — "
                f"will be soft; use AI upscaler for production."
            )

        panel_img = fit_and_crop(src_img, (bled_w, bled_h), crop_anchor=crop_anchor)
        panel_path = save_panel(panel, panel_img, out_dir, format=format, dpi=project.surface.dpi)
        result.panels.append(panel_path)
        result.notes.append(
            f"Panel {panel.id}: {src_path.name} → {panel_img.size[0]}×{panel_img.size[1]} px "
            f"(trim {pw}×{ph} + {project.surface.bleed_mm}mm bleed) → {panel_path.name}"
        )

    # Manifest
    manifest_path = out_dir / "manifest.yaml"
    manifest_path.write_text(_build_per_panel_manifest(result, project.surface, panel_sources))
    result.manifest = manifest_path
    return result


def _build_per_panel_manifest(result: DeliveryResult, surface, panel_sources: dict) -> str:
    lines = [
        f"# Delivery manifest — {result.project.title}",
        f"# Mode: per-panel",
        f"# Generated: {datetime.now().isoformat()}",
        "",
        f"client: {result.project.client}",
        f"project: {result.project.title}",
        f"surface:",
        f"  name: {surface.name}",
        f"  dpi: {surface.dpi}",
        f"  bleed_mm: {surface.bleed_mm}",
        "",
        f"# Every panel file is the trim size plus {surface.bleed_mm}mm of bleed on all",
        f"# four edges. Trim to the width_cm x height_cm below.",
        f"panel_sources:",
    ]
    for panel in surface.panels:
        lines.append(f"  {panel.id}: {panel_sources[panel.id]}")
    lines.append("")
    lines.append(f"deliverables:")
    for p in result.panels:
        lines.append(f"  - {p.name}")
    lines.append("")
    lines.append(f"notes:")
    for note in result.notes:
        lines.append(f"  - {note}")
    return "\n".join(lines) + "\n"


def _build_manifest(result: DeliveryResult, surface) -> str:
    lines = [
        f"# Delivery manifest — {result.project.title}",
        f"# Generated: {datetime.now().isoformat()}",
        "",
        f"client: {result.project.client}",
        f"project: {result.project.title}",
        f"source_image: {result.source}",
        f"surface:",
        f"  name: {surface.name}",
        f"  dpi: {surface.dpi}",
        f"  bleed_mm: {surface.bleed_mm}",
        f"  # Panel files carry {surface.bleed_mm}mm of bleed on all four edges;",
        f"  # the pixel sizes below are the trim size to cut to.",
        f"  panels:",
    ]
    for panel in surface.panels:
        w, h = panel.pixels(surface.dpi)
        lines.append(f"    - id: {panel.id}")
        lines.append(f"      width_cm: {panel.width_cm}")
        lines.append(f"      height_cm: {panel.height_cm}")
        lines.append(f"      pixels: {w}x{h}")
    lines.append("")
    lines.append("deliverables:")
    if result.full_mural:
        lines.append(f"  full_mural: {result.full_mural.name}")
    lines.append(f"  panels:")
    for p in result.panels:
        lines.append(f"    - {p.name}")
    lines.append("")
    lines.append("notes:")
    for note in result.notes:
        lines.append(f"  - {note}")
    return "\n".join(lines) + "\n"
