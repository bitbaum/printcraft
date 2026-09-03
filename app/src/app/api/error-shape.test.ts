import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * /api/surfaces and /api/compositions GET handlers collapsed every Supabase
 * error — a real DB outage, an RLS misconfiguration, not just "no row yet" —
 * into `{ success: false, data: null }`. useSurface/useComposition only throw
 * on `!success && error`, so with no `error` field the query resolved clean
 * to `data: null`, indistinguishable from "you haven't saved one yet". A
 * transient failure after the user saved their surface silently looked like
 * they'd never defined one, and the UI sent them back to redo work that was
 * already stored.
 *
 * Every other route in the app forwards `error.message` on failure; this
 * walks each `NextResponse.json({ success: false, ... })` call site in the
 * API layer and fails on any that omits `error`, so a route can't drop back
 * into the swallowed shape by hand.
 */
describe('every failed API response carries an error message', () => {
  const apiDir = join(process.cwd(), 'src/app/api');

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(path);
      return entry.name === 'route.ts' ? [path] : [];
    });
  }

  function isFalseLiteral(node: ts.Expression): boolean {
    return node.kind === ts.SyntaxKind.FalseKeyword;
  }

  function missingErrorIn(file: string): string[] {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const missing: string[] = [];

    function visit(node: ts.Node) {
      if (ts.isObjectLiteralExpression(node)) {
        const successProp = node.properties.find(
          (p): p is ts.PropertyAssignment =>
            ts.isPropertyAssignment(p) && p.name.getText(source) === 'success',
        );
        const hasError = node.properties.some(
          (p) => p.name?.getText(source) === 'error' || p.name?.getText(source) === 'details',
        );
        if (successProp && isFalseLiteral(successProp.initializer) && !hasError) {
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          missing.push(`${relative(apiDir, file)}:${line}`);
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
    return missing;
  }

  const files = routeFiles(apiDir);

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('leaves no failed response without an error field', () => {
    expect(files.flatMap(missingErrorIn)).toEqual([]);
  });
});
