import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * Three separate saves shipped with no failure path: figure placement in the
 * compose editor (#36), a figure's label and delete (e399f4a), and the styled
 * upload on FigureCard. Each looked identical in the UI whether it stored the
 * work or dropped it — the user was told nothing and lost the edit on refresh.
 *
 * A mutation that cannot report failure is a save the user cannot trust, so
 * this walks every `.mutate(...)` / `.mutateAsync(...)` call site in the app
 * and fails on any that passes no `onError`. Fixing the fourth instance by
 * hand is what this test exists to prevent.
 */
describe('every mutation call site reports its failures', () => {
  const srcDir = join(process.cwd(), 'src');

  function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(path);
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
      return [path];
    });
  }

  /** react-query takes the options object as the last argument of either call. */
  function handlesError(call: ts.CallExpression): boolean {
    return call.arguments.some(
      (arg) =>
        ts.isObjectLiteralExpression(arg) &&
        arg.properties.some((prop) => prop.name?.getText(arg.getSourceFile()) === 'onError'),
    );
  }

  function unhandledIn(file: string): string[] {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const unhandled: string[] = [];

    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.name.text === 'mutate' || node.expression.name.text === 'mutateAsync') &&
        !handlesError(node)
      ) {
        const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        unhandled.push(`${relative(srcDir, file)}:${line} ${node.expression.getText(source)}`);
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
    return unhandled;
  }

  const sources = filesUnder(srcDir);

  it('finds the app sources', () => {
    expect(sources.length).toBeGreaterThan(0);
  });

  it('finds the mutation call sites it is meant to guard', () => {
    const calls = sources.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return text.match(/\.mutate(Async)?\(/g) ?? [];
    });
    expect(calls.length).toBeGreaterThan(0);
  });

  it('leaves no mutation without an onError', () => {
    expect(sources.flatMap(unhandledIn)).toEqual([]);
  });
});
