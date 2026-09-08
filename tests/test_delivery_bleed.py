"""Panel files handed to a print shop must carry bleed on every edge.

`deliver_per_panel` — the path its own docstring calls recommended, and the one
the CLI help demonstrates — cropped to exactly the panel size, producing files
with no bleed at all. `split_into_panels` clamped its crop to the mural, so the
top, the bottom and the two outer sides had none either. A printer trims to the
panel size; any drift then exposes unprinted material along the edge, and
nothing in the manifest said the bleed was missing.

Bleed at a seam must be the neighbouring panel's real artwork, or the two
printed panels do not line up. Bleed at an outer boundary has no neighbour to
borrow from, so it is mirrored.
"""
from __future__ import annotations

import textwrap

import pytest
from PIL import Image

from printcraft.project import Project
from printcraft.compositor import deliver_per_panel, reflect_expand, split_into_panels


# 2 panels of 100x100 px at 100 dpi, 2.54mm bleed = 10 px per edge. Small so the
# tests stay fast; the relationships under test are size-independent.
SURFACE_YAML = textwrap.dedent(
    """
    client: TestClient
    title: Bleed Test
    status: in-progress
    surface:
      name: two-panel
      dpi: 100
      bleed_mm: 2.54
      panels:
        - id: left
          width_cm: 2.54
          height_cm: 2.54
        - id: right
          width_cm: 2.54
          height_cm: 2.54
    style: {name: s, prompt: p}
    scene: {setting: x}
    characters: []
    scenes: []
    """
)


@pytest.fixture
def project(tmp_path):
    (tmp_path / "project.yaml").write_text(SURFACE_YAML)
    return Project.load(tmp_path)


@pytest.fixture
def mural():
    """200x100 mural whose red channel encodes the x coordinate."""
    img = Image.new("RGB", (200, 100))
    img.putdata([(x, 0, 0) for _y in range(100) for x in range(200)])
    return img


def test_bleed_is_read_from_the_project_file(project):
    assert project.surface.bleed_mm == 2.54
    assert project.surface.bleed_px() == 10


def test_bleed_defaults_when_the_project_file_omits_it(tmp_path):
    (tmp_path / "project.yaml").write_text(SURFACE_YAML.replace("  bleed_mm: 2.54\n", ""))
    assert Project.load(tmp_path).surface.bleed_mm == 3.0


def test_every_panel_carries_bleed_on_all_four_edges(project, mural):
    bleed = project.surface.bleed_px()

    panels = split_into_panels(mural, project.surface)

    assert len(panels) == 2
    for panel, img in panels:
        trim_w, trim_h = panel.pixels(project.surface.dpi)
        assert img.size == (trim_w + 2 * bleed, trim_h + 2 * bleed)


def test_seam_bleed_is_the_neighbours_real_artwork(project, mural):
    """The left panel's right-hand bleed must continue into the right panel."""
    bleed = project.surface.bleed_px()
    left_panel = project.surface.panels[0]
    trim_w, _ = left_panel.pixels(project.surface.dpi)
    (_panel, left_img), _ = split_into_panels(mural, project.surface)

    # Final x = bleed + mural x. The first column past the trim line is the
    # right panel's first column, so its red channel is the mural x there.
    # A mirrored edge would repeat trim_w - 1 instead.
    assert left_img.getpixel((bleed + trim_w, bleed))[0] == trim_w
    assert left_img.getpixel((bleed + trim_w + bleed - 1, bleed))[0] == trim_w + bleed - 1


def test_outer_edge_bleed_is_mirrored(project, mural):
    """The mural's left edge has no neighbour, so it reflects its own content."""
    bleed = project.surface.bleed_px()
    (_panel, left_img), _ = split_into_panels(mural, project.surface)

    # Column bleed-1 sits just outside the trim line and mirrors mural x=0.
    assert left_img.getpixel((bleed - 1, bleed))[0] == 0
    assert left_img.getpixel((0, bleed))[0] == bleed - 1


def test_per_panel_delivery_carries_bleed(project, tmp_path):
    """The regression that started this: this path produced zero bleed."""
    src = tmp_path / "src.png"
    Image.new("RGB", (400, 400), (10, 20, 30)).save(src)
    bleed = project.surface.bleed_px()

    result = deliver_per_panel(project, {"left": str(src), "right": str(src)})

    assert len(result.panels) == 2
    for path, panel in zip(result.panels, project.surface.panels):
        trim_w, trim_h = panel.pixels(project.surface.dpi)
        assert Image.open(path).size == (trim_w + 2 * bleed, trim_h + 2 * bleed)


def test_per_panel_manifest_states_the_bleed(project, tmp_path):
    """The shop cuts to the trim size — it has to be told the files are bigger."""
    src = tmp_path / "src.png"
    Image.new("RGB", (400, 400), (10, 20, 30)).save(src)

    result = deliver_per_panel(project, {"left": str(src), "right": str(src)})

    assert "bleed_mm: 2.54" in result.manifest.read_text()


def test_reflect_expand_mirrors_each_side():
    img = Image.new("RGB", (4, 4))
    img.putdata([(x, y, 0) for y in range(4) for x in range(4)])

    out = reflect_expand(img, left=2, top=1, right=0, bottom=0)

    assert out.size == (6, 5)
    assert out.getpixel((2, 1)) == (0, 0, 0)  # original origin, shifted
    assert out.getpixel((1, 1))[0] == 0  # mirrored: nearest column repeats
    assert out.getpixel((0, 1))[0] == 1


def test_reflect_expand_is_a_no_op_without_padding():
    img = Image.new("RGB", (3, 3), (7, 7, 7))
    assert reflect_expand(img, 0, 0, 0, 0) is img


def test_reflect_expand_refuses_to_invent_more_than_it_has():
    img = Image.new("RGB", (4, 4))
    with pytest.raises(ValueError, match="Cannot reflect more than the image"):
        reflect_expand(img, left=5, top=0, right=0, bottom=0)
