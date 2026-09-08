"""A partly-failed generation round must not report success.

Round 010 of the Duschwand lost two of its inpaints to a rate limit in April
and sat unfinished for five months. The generator had detected the limit and
returned `success=False` correctly — the CLI printed a red line and exited 0,
so every wrapper, `&&` chain and scrolled-past terminal read the round as done.

These tests pin the two halves of the fix: a failure exits non-zero, and a
retry can fill only the gaps instead of overwriting the images that worked.
"""
from __future__ import annotations

from typer.testing import CliRunner

from printcraft.cli import app
from printcraft.generators.grok import output_path


runner = CliRunner()


def test_single_scene_failure_exits_non_zero(project_dir, fake_generator):
    fake_generator.fails = {"alpha"}

    result = runner.invoke(app, ["generate", "scene", str(project_dir), "alpha", "-r", "r1"])

    assert result.exit_code != 0, "a failed generation reported success to the shell"
    assert "Failed" in result.output


def test_single_scene_success_exits_zero(project_dir, fake_generator):
    result = runner.invoke(app, ["generate", "scene", str(project_dir), "alpha", "-r", "r1"])

    assert result.exit_code == 0
    assert output_path(project_dir / "rounds/r1/outputs", "alpha").exists()


def test_partial_round_exits_non_zero_and_names_the_failures(project_dir, fake_generator):
    fake_generator.fails = {"beta"}

    result = runner.invoke(app, ["generate", "all-scenes", str(project_dir), "-r", "r1"])

    assert result.exit_code != 0, "2 of 3 scenes is not a successful round"
    assert "beta" in result.output
    # The ones that worked are still on disk — a failure must not discard them.
    assert output_path(project_dir / "rounds/r1/outputs", "alpha").exists()
    assert output_path(project_dir / "rounds/r1/outputs", "gamma").exists()


def test_fully_successful_round_exits_zero(project_dir, fake_generator):
    result = runner.invoke(app, ["generate", "all-scenes", str(project_dir), "-r", "r1"])

    assert result.exit_code == 0
    assert sorted(fake_generator.calls) == ["alpha", "beta", "gamma"]


def test_only_missing_regenerates_just_the_gap(project_dir, fake_generator):
    fake_generator.fails = {"beta"}
    first = runner.invoke(app, ["generate", "all-scenes", str(project_dir), "-r", "r1"])
    assert first.exit_code != 0

    # The retry: beta is the only scene without an output, so it is the only
    # one attempted — alpha and gamma are not regenerated (and not overwritten).
    fake_generator.fails = set()
    fake_generator.calls = []
    retry = runner.invoke(
        app, ["generate", "all-scenes", str(project_dir), "-r", "r1", "--only-missing"]
    )

    assert retry.exit_code == 0
    assert fake_generator.calls == ["beta"]
    assert output_path(project_dir / "rounds/r1/outputs", "beta").exists()


def test_only_missing_with_nothing_missing_is_a_no_op(project_dir, fake_generator):
    assert runner.invoke(app, ["generate", "all-scenes", str(project_dir), "-r", "r1"]).exit_code == 0

    fake_generator.calls = []
    again = runner.invoke(
        app, ["generate", "all-scenes", str(project_dir), "-r", "r1", "--only-missing"]
    )

    assert again.exit_code == 0
    assert fake_generator.calls == [], "a completed round should cost nothing to re-run"
