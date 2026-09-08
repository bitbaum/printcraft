"""Grok image generation via browser automation.

Hard-won findings (see docs/LEARNINGS.md for the full story):
- Grok uses a standard <textarea> (formerly ProseMirror). Newlines work natively.
- `page.keyboard.type()` triggers React state correctly; JS native setter does NOT.
- SHORT prompts (~200 chars) trigger Aurora illustration mode.
- LONG prompts cause Grok to switch to text-mode photo editing (wrong output).
- Submit button (aria-label="Absenden"/"Submit") is hidden after upload;
  click via JS: `page.evaluate(() => btn.click())`.
- Image URLs: `assets.grok.com/.../generated/` (exclude /content/ — those are uploads).
- Connect via CDP to an existing Chrome: launch with
  `--user-data-dir=... --remote-debugging-port=9222 --remote-allow-origins=*`
- Free tier: ~3 images per 2 hours. SuperGrok: effectively unlimited if you're
  signed in and use the short-prompt approach.
"""
from __future__ import annotations

import base64
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from playwright.sync_api import Page, sync_playwright


GROK_URL = "https://grok.com/"
DEFAULT_CDP_PORTS = [9222, 9333, 40967]


def output_path(output_dir: str | Path, prefix: str, index: int = 0) -> Path:
    """Where one generated image lands. Index 0 is the primary, the rest are alternates.

    The only definition of this naming — callers ask here instead of rebuilding
    the pattern, so "does this scene already have an output?" cannot drift from
    what `generate()` actually writes.
    """
    suffix = "" if index == 0 else f"_alt{index}"
    return Path(output_dir) / f"{prefix}{suffix}.jpg"


@dataclass
class GrokConfig:
    """Configuration for Grok generation."""
    cdp_url: Optional[str] = None  # e.g. "http://127.0.0.1:9222"
    user_data_dir: Optional[str] = None  # for launch_persistent_context fallback
    headless: bool = False
    page_load_wait_s: int = 8
    max_wait_ticks: int = 36  # * 5s = 3 min
    type_delay_ms: int = 2
    # Short prompts are critical — long prompts trigger photo-edit mode instead of Aurora
    max_prompt_chars: int = 600


@dataclass
class GenerationResult:
    """Output of a single generation."""
    scene_id: str
    prompt: str
    outputs: list[Path] = field(default_factory=list)
    success: bool = False
    error: Optional[str] = None
    reference_photo: Optional[Path] = None


class GrokGenerator:
    """Browser-automated Grok image generator.

    Typical usage:
        with GrokGenerator() as gen:
            result = gen.generate(
                scene_id="hero",
                prompt="Retro 1960s poster of...",
                reference_photo="source/photos/1.png",
                output_dir="rounds/001-retro/outputs",
            )
    """

    def __init__(self, config: Optional[GrokConfig] = None):
        self.config = config or GrokConfig()
        self._playwright = None
        self._browser = None
        self._context = None
        self._page: Optional[Page] = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *exc):
        self.close()

    def start(self):
        self._playwright = sync_playwright().start()
        self._browser = None

        # Try connecting via CDP first (user's logged-in Chrome)
        if self.config.cdp_url:
            try:
                self._browser = self._playwright.chromium.connect_over_cdp(self.config.cdp_url)
            except Exception:
                pass
        else:
            for port in DEFAULT_CDP_PORTS:
                try:
                    self._browser = self._playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
                    break
                except Exception:
                    continue

        if self._browser:
            self._context = self._browser.contexts[0]
            # Reuse existing Grok page if one exists
            for pg in self._context.pages:
                if "grok.com" in pg.url:
                    self._page = pg
                    break
            if not self._page:
                self._page = self._context.new_page()
        else:
            # Fallback: launch our own persistent browser
            user_dir = self.config.user_data_dir or str(Path.home() / ".cache" / "printcraft-chrome")
            self._context = self._playwright.chromium.launch_persistent_context(
                user_data_dir=user_dir,
                headless=self.config.headless,
                args=["--no-sandbox"],
            )
            self._page = self._context.pages[0] if self._context.pages else self._context.new_page()

    def close(self):
        if self._browser is None and self._context:
            self._context.close()
        if self._playwright:
            self._playwright.stop()

    # ------------------------------------------------------------------

    def generate(
        self,
        scene_id: str,
        prompt: str,
        reference_photo: Optional[str | Path] = None,
        output_dir: Optional[str | Path] = None,
        file_prefix: Optional[str] = None,
    ) -> GenerationResult:
        """Generate one image. Returns GenerationResult with saved file paths."""
        output_dir = Path(output_dir) if output_dir else Path.cwd()
        output_dir.mkdir(parents=True, exist_ok=True)
        prefix = file_prefix or scene_id

        result = GenerationResult(
            scene_id=scene_id,
            prompt=prompt,
            reference_photo=Path(reference_photo) if reference_photo else None,
        )

        if len(prompt) > self.config.max_prompt_chars:
            result.error = (
                f"Prompt is {len(prompt)} chars, exceeds {self.config.max_prompt_chars}. "
                f"Long prompts trigger photo-edit mode instead of Aurora."
            )
            return result

        try:
            self._navigate_fresh()
            if reference_photo:
                self._upload_reference(Path(reference_photo))
            self._enter_prompt(prompt)
            pre_existing = self._capture_existing_images()
            self._submit()
            urls = self._wait_for_generation(pre_existing)

            if not urls:
                result.error = "No images generated (timeout or rate limit)"
                return result

            for i, url in enumerate(urls):
                path = output_path(output_dir, prefix, i)
                if self._download_image(url, path):
                    result.outputs.append(path)

            result.success = len(result.outputs) > 0
        except Exception as e:
            result.error = f"{type(e).__name__}: {e}"

        return result

    # ------------------------------------------------------------------
    # Internal steps (each documented with why it's done this way)

    def _navigate_fresh(self):
        self._page.goto(GROK_URL, wait_until="domcontentloaded", timeout=30000)
        try:
            self._page.wait_for_selector("textarea", timeout=20000)
        except Exception:
            time.sleep(10)
        time.sleep(self.config.page_load_wait_s)

    def _upload_reference(self, photo: Path):
        if not photo.exists():
            raise FileNotFoundError(f"Reference photo not found: {photo}")
        fi = None
        for _ in range(10):
            fi = self._page.query_selector('input[type="file"]')
            if fi:
                break
            time.sleep(2)
        if not fi:
            raise RuntimeError("No file input found on Grok page")
        fi.set_input_files(str(photo))
        time.sleep(3)

    def _enter_prompt(self, prompt: str):
        """Use keyboard.type() — triggers React state correctly. JS setter does NOT."""
        self._page.evaluate("""() => {
            const ta = document.querySelector('textarea');
            if (ta) ta.focus();
        }""")
        time.sleep(0.5)
        self._page.keyboard.type(prompt, delay=self.config.type_delay_ms)
        time.sleep(1)

    def _capture_existing_images(self) -> set[str]:
        pre = set()
        for img in self._page.query_selector_all("img"):
            src = img.get_attribute("src") or ""
            if "assets.grok.com" in src:
                pre.add(src)
        return pre

    def _submit(self):
        """Click hidden submit button via JS (not page.click — button is display:none)."""
        self._page.evaluate("""() => {
            const labels = ['Absenden', 'Submit', 'Send', 'Senden'];
            for (const label of labels) {
                const btn = document.querySelector(`button[aria-label="${label}"]`);
                if (btn) { btn.click(); return label; }
            }
            return null;
        }""")

    def _wait_for_generation(self, pre_existing: set[str]) -> list[str]:
        """Poll for new generated images. Returns list of unique URLs."""
        found: list[str] = []
        for tick in range(self.config.max_wait_ticks):
            time.sleep(5)
            for img in self._page.query_selector_all("img"):
                src = img.get_attribute("src") or ""
                if (
                    "assets.grok.com" in src
                    and "/generated/" in src
                    and src not in found
                    and src not in pre_existing
                ):
                    try:
                        w = img.evaluate("el => el.naturalWidth") or 0
                        if w > 200:
                            found.append(src)
                    except Exception:
                        found.append(src)

            # Settle period — wait once after finding images in case there are alternates
            if found and tick > 3:
                time.sleep(5)
                for img in self._page.query_selector_all("img"):
                    src = img.get_attribute("src") or ""
                    if (
                        "assets.grok.com" in src
                        and "/generated/" in src
                        and src not in found
                        and src not in pre_existing
                    ):
                        found.append(src)
                break

            # Rate limit detection
            if tick > 0 and tick % 6 == 0:
                body = self._page.inner_text("body")
                if "Limit" in body and ("zurück" in body or "reset" in body.lower()):
                    raise RuntimeError("Rate limited — wait for reset and retry")

        return found

    def _download_image(self, url: str, out_path: Path) -> bool:
        """Download via in-page fetch (preserves auth cookies)."""
        try:
            b64 = self._page.evaluate(
                """async (url) => {
                    const r = await fetch(url, { credentials: 'include' });
                    if (!r.ok) return null;
                    const b = await r.blob();
                    return new Promise(res => {
                        const rd = new FileReader();
                        rd.onloadend = () => res(rd.result);
                        rd.readAsDataURL(b);
                    });
                }""",
                url,
            )
            if b64 and b64.startswith("data:"):
                raw = base64.b64decode(b64.split(",", 1)[1])
                out_path.write_bytes(raw)
                return True
        except Exception:
            pass
        return False
