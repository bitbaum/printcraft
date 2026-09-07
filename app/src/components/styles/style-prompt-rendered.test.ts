import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `prompt_template` and `negative_prompt` were seeded on every style row,
 * declared on the `Style` type and shipped to the browser by
 * GET /api/projects/[id] (which joins `style:styles(*)`) — and then read by
 * nothing. The figures step told the user to "use an AI tool" to produce the
 * styled version and never showed the prompt the style was written for, so the
 * style choice stopped at a progress checkmark and every figure got whatever
 * prompt its user recalled. Figures only merge into one scene when they were
 * all generated the same way, so that is a Ground Truth #3 failure.
 *
 * Same shape as the orphaned /api/compositions route guarded by
 * lib/api/wired.test.ts, one level down: there it was a route with no caller,
 * here a column with no reader. A column the app fetches and never shows is a
 * feature that silently does not exist.
 */
describe("the chosen style's generation prompt reaches the user", () => {
  const srcDir = join(process.cwd(), 'src');
  // The type declares these fields and the API select is a `*`, so neither
  // proves anything about the user ever seeing them.
  const typesDir = join(srcDir, 'types');

  function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(path);
      return /\.tsx?$/.test(entry.name) ? [path] : [];
    });
  }

  const renderingSources = filesUnder(srcDir)
    .filter((file) => !file.startsWith(typesDir) && !/\.test\.tsx?$/.test(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  it.each(['prompt_template', 'negative_prompt'])(
    "renders the style row's %s somewhere outside the type declaration",
    (field) => {
      expect(renderingSources).toContain(field);
    },
  );

  it('offers the prompt on the figures step, where the styled image is produced', () => {
    const figuresPage = readFileSync(join(srcDir, 'app/project/[id]/figures/page.tsx'), 'utf8');
    expect(figuresPage).toContain('StylePromptPanel');
  });
});
