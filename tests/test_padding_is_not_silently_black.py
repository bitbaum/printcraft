"""Padding must draw what it says it draws.

`fit_and_pad`'s "reflect" and "edge" modes ran through numpy, and numpy was
never a declared dependency of this package. On any machine without it the
`except ImportError` arm silently rewrote pad_mode to "black", so `deliver`
built the full mural with solid black bars where reflected artwork was meant to
be, split those bars into panel files, and reported them as print-ready.
Measured before the fix: a 50x100 source into a 200x100 surface came out with
150 of 200 columns pure black.

Mirroring can only supply as much as the artwork holds, so an extreme aspect
mismatch now says so instead of inventing a fill. "edge" repeats a single
border pixel and can therefore cover any distance.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from printcraft.compositor import edge_expand, fit_and_pad


ART = (200, 30, 30)
BLACK = (0, 0, 0)


def black_pixels(img: Image.Image) -> int:
    # getcolors over the full RGB space: exact, and not the deprecated getdata.
    return sum(count for count, color in img.getcolors(maxcolors=2**24) if color == BLACK)


def test_reflect_fills_with_artwork_not_black():
    """A mismatch small enough to mirror is filled from the image itself."""
    src = Image.new("RGB", (180, 100), ART)

    out = fit_and_pad(src, (200, 100), pad_mode="reflect")

    assert out.size == (200, 100)
    assert black_pixels(out) == 0


def test_reflect_refuses_a_mismatch_it_cannot_mirror():
    """The exact case that used to yield 150 black columns."""
    src = Image.new("RGB", (50, 100), ART)

    with pytest.raises(ValueError, match="too far from the .* surface aspect to mirror"):
        fit_and_pad(src, (200, 100), pad_mode="reflect")


def test_the_refusal_names_a_way_forward():
    """A delivery-path error is only useful if it says what to do instead."""
    src = Image.new("RGB", (50, 100), ART)

    with pytest.raises(ValueError) as excinfo:
        fit_and_pad(src, (200, 100), pad_mode="reflect")

    message = str(excinfo.value)
    assert "deliver-panels" in message
    assert "--pad edge" in message


def test_edge_covers_a_mismatch_reflect_cannot():
    """`edge` repeats a border pixel, so it has no distance limit."""
    src = Image.new("RGB", (50, 100), ART)

    out = fit_and_pad(src, (200, 100), pad_mode="edge")

    assert out.size == (200, 100)
    assert black_pixels(out) == 0


def test_solid_modes_still_pad_solid():
    src = Image.new("RGB", (50, 100), ART)

    assert black_pixels(fit_and_pad(src, (200, 100), pad_mode="black")) > 0
    white = fit_and_pad(src, (200, 100), pad_mode="white")
    assert white.getpixel((0, 50)) == (255, 255, 255)


def test_unknown_pad_mode_is_refused_rather_than_guessed():
    src = Image.new("RGB", (50, 100), ART)

    with pytest.raises(ValueError, match="Unknown pad_mode"):
        fit_and_pad(src, (200, 100), pad_mode="mirrorish")


def test_edge_expand_repeats_the_border_pixel():
    img = Image.new("RGB", (2, 2))
    img.putdata([(10, 0, 0), (20, 0, 0), (10, 0, 0), (20, 0, 0)])

    out = edge_expand(img, left=3, top=0, right=0, bottom=0)

    assert out.size == (5, 2)
    assert [out.getpixel((x, 0))[0] for x in range(5)] == [10, 10, 10, 10, 20]


def test_edge_expand_is_a_no_op_without_padding():
    img = Image.new("RGB", (3, 3), ART)
    assert edge_expand(img, 0, 0, 0, 0) is img


def test_the_package_does_not_import_numpy():
    """numpy is undeclared, and an optional import must never change output.

    That is the whole defect this file exists for: a missing import quietly
    swapped reflected artwork for black bars on the path that produces the
    client's print files.
    """
    package = Path(__file__).resolve().parent.parent / "printcraft"
    offenders = [
        path.relative_to(package.parent)
        for path in package.rglob("*.py")
        if "import numpy" in path.read_text()
    ]
    assert offenders == [], f"numpy imported by: {offenders}"


def test_deliver_reports_an_impossible_pad_cleanly(tmp_path):
    """The operator sees the guidance, not a traceback — and the shell sees 1."""
    from typer.testing import CliRunner

    from printcraft.cli import app

    (tmp_path / "project.yaml").write_text(
        "client: E2E\ntitle: E2E\nstatus: in-progress\n"
        "surface:\n  name: s\n  dpi: 50\n  panels:\n"
        "    - {id: left, width_cm: 20, height_cm: 20}\n"
        "    - {id: right, width_cm: 20, height_cm: 20}\n"
        "style: {name: s, prompt: p}\nscene: {setting: x}\ncharacters: []\nscenes: []\n"
    )
    Image.new("RGB", (100, 400), ART).save(tmp_path / "wild.png")

    result = CliRunner().invoke(app, ["deliver", str(tmp_path), "wild.png"])

    assert result.exit_code == 1
    assert "deliver-panels" in result.output
    assert result.exception is None or isinstance(result.exception, SystemExit)
