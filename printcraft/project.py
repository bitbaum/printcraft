"""Project loader — single source of truth for client projects.

Reads `project.yaml` and provides typed access to surfaces, scenes, characters,
and style. All generation and compositing derives from this file.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import yaml


@dataclass
class Panel:
    id: str
    width_cm: float
    height_cm: float

    def pixels(self, dpi: int) -> tuple[int, int]:
        cm_to_inch = 1 / 2.54
        return (
            int(self.width_cm * cm_to_inch * dpi),
            int(self.height_cm * cm_to_inch * dpi),
        )


@dataclass
class Surface:
    name: str
    panels: list[Panel]
    dpi: int = 150
    # Bleed is a property of the physical print, like dpi: the printer trims to
    # the panel size and any drift exposes unprinted material, so the artwork
    # has to extend past the trim line. One definition here, used by every
    # delivery path — a per-call default drifts from what the shop asked for.
    bleed_mm: float = 3.0

    def bleed_px(self) -> int:
        """Bleed in pixels at this surface's dpi."""
        return int((self.bleed_mm / 10) * (self.dpi / 2.54))

    def total_pixels(self) -> tuple[int, int]:
        """Combined width (sum of panels) and max height."""
        w = sum(p.pixels(self.dpi)[0] for p in self.panels)
        h = max(p.pixels(self.dpi)[1] for p in self.panels)
        return w, h


@dataclass
class Character:
    id: str
    role: str = "supporting"
    reference_photo: Optional[str] = None
    notes: str = ""


@dataclass
class Scene:
    id: str
    description: str
    reference_photo: Optional[str] = None
    character_ids: list[str] = field(default_factory=list)
    composition_role: str = "supporting"  # hero | supporting | background


@dataclass
class Style:
    name: str
    prompt: str
    negative: str = ""


@dataclass
class Project:
    root: Path  # project directory
    client: str
    title: str
    status: str
    surface: Surface
    style: Style
    scene_setting: str
    characters: list[Character]
    scenes: list[Scene]

    @classmethod
    def load(cls, path: str | Path) -> "Project":
        """Load a project from its directory (expects project.yaml inside)."""
        root = Path(path).resolve()
        yaml_path = root / "project.yaml"
        if not yaml_path.exists():
            raise FileNotFoundError(f"No project.yaml at {yaml_path}")

        data = yaml.safe_load(yaml_path.read_text())

        surface = Surface(
            name=data["surface"]["name"],
            panels=[Panel(**p) for p in data["surface"]["panels"]],
            dpi=data["surface"].get("dpi", 150),
            bleed_mm=float(data["surface"].get("bleed_mm", 3.0)),
        )

        style = Style(**data["style"])

        characters = [Character(**c) for c in data.get("characters", [])]
        scenes = [Scene(**s) for s in data.get("scenes", [])]

        return cls(
            root=root,
            client=data["client"],
            title=data["title"],
            status=data.get("status", "in-progress"),
            surface=surface,
            style=style,
            scene_setting=data.get("scene", {}).get("setting", ""),
            characters=characters,
            scenes=scenes,
        )

    def resolve(self, relative_path: str) -> Path:
        """Resolve a path relative to the project root."""
        return self.root / relative_path

    def scene(self, scene_id: str) -> Scene:
        for s in self.scenes:
            if s.id == scene_id:
                return s
        raise KeyError(f"Scene '{scene_id}' not found")

    def character(self, char_id: str) -> Character:
        for c in self.characters:
            if c.id == char_id:
                return c
        raise KeyError(f"Character '{char_id}' not found")

    def round_dir(self, round_name: str, create: bool = False) -> Path:
        """Get (or create) a generation round directory."""
        d = self.root / "rounds" / round_name
        if create:
            (d / "prompts").mkdir(parents=True, exist_ok=True)
            (d / "outputs").mkdir(parents=True, exist_ok=True)
        return d

    def selected_dir(self) -> Path:
        return self.root / "selected"

    def deliverables_dir(self) -> Path:
        return self.root / "deliverables"
