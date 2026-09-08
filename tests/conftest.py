"""Shared fixtures for the pipeline tests."""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from printcraft.generators.grok import GenerationResult


PROJECT_YAML = textwrap.dedent(
    """
    client: TestClient
    title: Test Project
    status: in-progress
    surface:
      name: test-surface
      dpi: 150
      panels:
        - id: main
          width_cm: 100
          height_cm: 100
    style:
      name: test-style
      prompt: A short style prompt.
    scene:
      setting: Somewhere
      description: A scene.
    characters: []
    scenes:
      - id: alpha
        description: Scene alpha.
      - id: beta
        description: Scene beta.
      - id: gamma
        description: Scene gamma.
    """
)


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    """A minimal but real project on disk — three scenes, no reference photos."""
    (tmp_path / "project.yaml").write_text(PROJECT_YAML)
    return tmp_path


class FakeGenerator:
    """Stands in for GrokGenerator so no browser or network is involved.

    `fails` names the scene ids that should come back unsuccessful, which is how
    a rate limit presents itself: the generator reports it correctly, and the
    question under test is only what the CLI does with that report.
    """

    fails: set[str] = set()
    calls: list[str] = []

    def __init__(self, config=None):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def generate(self, scene_id, prompt, reference_photo=None, output_dir=None, file_prefix=None):
        type(self).calls.append(scene_id)
        result = GenerationResult(scene_id=scene_id, prompt=prompt)
        if scene_id in type(self).fails:
            result.error = "Rate limited — wait for reset and retry"
            return result
        from printcraft.generators.grok import output_path

        path = output_path(output_dir, file_prefix or scene_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b"fake-jpeg")
        result.outputs.append(path)
        result.success = True
        return result


@pytest.fixture
def fake_generator(monkeypatch):
    """Install FakeGenerator in place of the real one, with per-test failure control."""
    import printcraft.cli as cli

    FakeGenerator.fails = set()
    FakeGenerator.calls = []
    monkeypatch.setattr(cli, "GrokGenerator", FakeGenerator)
    return FakeGenerator
