"""Command-line interface for PrintCraft.

Usage:
    printcraft project info <path>              # Show project summary
    printcraft project list-scenes <path>       # List scenes defined in project.yaml
    printcraft generate scene <path> <scene-id> [--round NAME]
    printcraft generate all-scenes <path> [--round NAME] [--only-missing]

Both generate commands exit non-zero if any scene failed, so a rate limit
cannot be mistaken for a finished round. Re-run with --only-missing to fill
just the gaps.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from printcraft.project import Project
from printcraft.generators.grok import GrokGenerator, GrokConfig, output_path
from printcraft.compositor import deliver_mural, deliver_per_panel


app = typer.Typer(help="PrintCraft — custom artwork for physical print surfaces")
project_app = typer.Typer(help="Project management commands")
generate_app = typer.Typer(help="Generation commands")
app.add_typer(project_app, name="project")
app.add_typer(generate_app, name="generate")

console = Console()


@project_app.command("info")
def project_info(path: Path = typer.Argument(..., help="Project directory")):
    """Show a project summary."""
    p = Project.load(path)
    console.print(f"[bold cyan]{p.title}[/bold cyan]")
    console.print(f"Client: {p.client}")
    console.print(f"Status: {p.status}")
    console.print(f"Root: {p.root}")
    console.print()
    console.print(f"[bold]Surface:[/bold] {p.surface.name} @ {p.surface.dpi} DPI")
    for panel in p.surface.panels:
        w, h = panel.pixels(p.surface.dpi)
        console.print(f"  {panel.id}: {panel.width_cm}×{panel.height_cm} cm → {w}×{h} px")
    total_w, total_h = p.surface.total_pixels()
    console.print(f"  [dim]Total: {total_w}×{total_h} px[/dim]")
    console.print()
    console.print(f"[bold]Style:[/bold] {p.style.name}")
    console.print(f"[bold]Scene:[/bold] {p.scene_setting}")
    console.print()
    console.print(f"[bold]Characters:[/bold] {len(p.characters)}")
    console.print(f"[bold]Scenes:[/bold] {len(p.scenes)}")


@project_app.command("list-scenes")
def list_scenes(path: Path = typer.Argument(..., help="Project directory")):
    """List all scenes defined in the project."""
    p = Project.load(path)
    table = Table(title=f"Scenes — {p.title}")
    table.add_column("ID", style="cyan")
    table.add_column("Role", style="yellow")
    table.add_column("Description")
    table.add_column("Ref photo", style="dim")
    for s in p.scenes:
        table.add_row(
            s.id,
            s.composition_role,
            s.description[:60] + ("..." if len(s.description) > 60 else ""),
            s.reference_photo or "—",
        )
    console.print(table)


@generate_app.command("scene")
def generate_scene(
    path: Path = typer.Argument(..., help="Project directory"),
    scene_id: str = typer.Argument(..., help="Scene ID from project.yaml"),
    round_name: Optional[str] = typer.Option(None, "--round", "-r"),
    cdp_url: Optional[str] = typer.Option(None, "--cdp"),
):
    """Generate a single scene."""
    p = Project.load(path)
    scene = p.scene(scene_id)

    if not round_name:
        round_name = f"{date.today().isoformat()}-adhoc"
    round_dir = p.round_dir(round_name, create=True)

    prompt = f"{scene.description}\n\n{p.style.prompt}"
    prompt_file = round_dir / "prompts" / f"{scene.id}.txt"
    prompt_file.write_text(prompt)

    ref = p.resolve(scene.reference_photo) if scene.reference_photo else None

    console.print(f"[cyan]Generating[/cyan] {scene.id} → {round_dir}/outputs/")
    console.print(f"[dim]Reference: {ref}[/dim]")
    console.print(f"[dim]Prompt ({len(prompt)} chars): {prompt[:80]}...[/dim]")

    config = GrokConfig(cdp_url=cdp_url)
    with GrokGenerator(config) as gen:
        result = gen.generate(
            scene_id=scene.id,
            prompt=prompt,
            reference_photo=ref,
            output_dir=round_dir / "outputs",
            file_prefix=scene.id,
        )

    if result.success:
        console.print(f"[green]✓ Saved {len(result.outputs)} image(s)[/green]")
        for out in result.outputs:
            console.print(f"  {out}")
    else:
        console.print(f"[red]✗ Failed: {result.error}[/red]")
        # A rate limit mid-round used to print this line and still exit 0, so a
        # wrapper, an `&&` chain or a scrolled-past terminal read it as success.
        # That is how round 010 lost two inpaints and sat unfinished for months.
        raise typer.Exit(code=1)


@generate_app.command("all-scenes")
def generate_all_scenes(
    path: Path = typer.Argument(..., help="Project directory"),
    round_name: Optional[str] = typer.Option(None, "--round", "-r"),
    cdp_url: Optional[str] = typer.Option(None, "--cdp"),
    only_missing: bool = typer.Option(
        False,
        "--only-missing",
        "-m",
        help="Skip scenes that already have an output in this round — resume after a rate limit "
        "without regenerating (and overwriting) the ones that worked.",
    ),
):
    """Generate every scene defined in the project."""
    p = Project.load(path)
    if not round_name:
        round_name = f"{date.today().isoformat()}-all"
    round_dir = p.round_dir(round_name, create=True)
    outputs_dir = round_dir / "outputs"

    pending = [
        s for s in p.scenes if not (only_missing and output_path(outputs_dir, s.id).exists())
    ]
    skipped = len(p.scenes) - len(pending)
    if skipped:
        console.print(f"[dim]Skipping {skipped} scene(s) that already have output[/dim]")

    config = GrokConfig(cdp_url=cdp_url)
    results = []
    if pending:
        with GrokGenerator(config) as gen:
            for scene in pending:
                prompt = f"{scene.description}\n\n{p.style.prompt}"
                (round_dir / "prompts" / f"{scene.id}.txt").write_text(prompt)
                ref = p.resolve(scene.reference_photo) if scene.reference_photo else None
                console.print(f"[cyan]→[/cyan] {scene.id}")
                result = gen.generate(
                    scene_id=scene.id,
                    prompt=prompt,
                    reference_photo=ref,
                    output_dir=outputs_dir,
                    file_prefix=scene.id,
                )
                results.append(result)
                if result.success:
                    console.print(f"  [green]✓[/green] {len(result.outputs)} file(s)")
                else:
                    console.print(f"  [red]✗[/red] {result.error}")

    ok = sum(1 for r in results if r.success)
    failed = [r for r in results if not r.success]
    console.print(f"\n[bold]{ok}/{len(results)} scenes generated successfully[/bold]")

    if failed:
        # Naming them beats re-reading the scrollback, and `--only-missing` makes
        # the retry cheap. Exiting non-zero is what stops a partial round from
        # being mistaken for a finished one.
        console.print(f"[red]✗ Failed: {', '.join(r.scene_id for r in failed)}[/red]")
        console.print("[dim]Retry just these with --only-missing[/dim]")
        raise typer.Exit(code=1)


@app.command("deliver-panels")
def deliver_panels_cmd(
    path: Path = typer.Argument(..., help="Project directory"),
    mapping: list[str] = typer.Argument(..., help="panel_id=source_image pairs, e.g. left=attempt5.jpg right=attempt6.jpg"),
    format: str = typer.Option("png", "--format", "-f", help="Output format: png | jpg | tiff"),
    crop: str = typer.Option("center", "--crop", help="Crop anchor: center | top | bottom | left | right"),
):
    """Per-panel delivery: assign a different source to each panel, crop to fit.

    Use this when your source images don't match the unwrapped aspect ratio —
    better than padding, which creates visible seams.

    Example:
        printcraft deliver-panels projects/duschwand-roli \\
          left=attempt5.jpg right=attempt6.jpg
    """
    p = Project.load(path)
    panel_sources: dict[str, str] = {}
    for pair in mapping:
        if "=" not in pair:
            raise typer.BadParameter(f"Expected panel_id=image, got: {pair}")
        pid, src = pair.split("=", 1)
        panel_sources[pid.strip()] = src.strip()
    console.print(f"[cyan]Delivering[/cyan] {p.title} (per-panel mode)")
    for pid, src in panel_sources.items():
        console.print(f"  {pid} ← {src}")
    try:
        result = deliver_per_panel(p, panel_sources, format=format, crop_anchor=crop)
    except (ValueError, FileNotFoundError) as err:
        # These say what the operator got wrong and what to do instead; a raw
        # traceback buries that. Unexpected exceptions still surface as bugs.
        console.print(f"[red]✗ {err}[/red]")
        raise typer.Exit(code=1)
    console.print()
    for note in result.notes:
        console.print(f"  {note}")
    console.print()
    console.print(f"[green]✓ Delivered[/green] {len(result.panels)} panels")
    console.print(f"[dim]Output: {result.panels[0].parent}[/dim]")


@app.command("deliver")
def deliver(
    path: Path = typer.Argument(..., help="Project directory"),
    source: str = typer.Argument(..., help="Source mural image (filename or path)"),
    pad_mode: str = typer.Option("reflect", "--pad", help="Padding strategy: reflect | edge | black | white"),
    format: str = typer.Option("png", "--format", "-f", help="Output format: png | jpg | tiff"),
):
    """Produce print-ready panel files from a selected mural image.

    Pipeline: scale source → fit to surface dimensions → split into panels → export.
    Writes to projects/<name>/deliverables/YYYY-MM-DD-HHMMSS-<source>/.
    """
    p = Project.load(path)
    console.print(f"[cyan]Delivering[/cyan] {p.title} — source: [bold]{source}[/bold]")
    try:
        result = deliver_mural(p, source, pad_mode=pad_mode, format=format)
    except (ValueError, FileNotFoundError) as err:
        console.print(f"[red]✗ {err}[/red]")
        raise typer.Exit(code=1)
    console.print()
    for note in result.notes:
        console.print(f"  {note}")
    console.print()
    console.print(f"[green]✓ Delivered[/green] {len(result.panels)} panels")
    console.print(f"[dim]Output: {result.panels[0].parent}[/dim]")


if __name__ == "__main__":
    app()
