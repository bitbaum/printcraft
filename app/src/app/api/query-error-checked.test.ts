import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * compositions POST computed the next version from
 * `const { data: existing } = await supabase...single()`, dropping `error`
 * entirely. `.single()` throws when zero rows match — the normal case for a
 * project's first composition — so a real query failure (RLS misconfig, DB
 * outage) looked identical to "no composition yet": both leave `data` null.
 * Silently defaulting to version 1 on a genuine failure risked inserting a
 * colliding/duplicate version instead of surfacing the failure.
 *
 * This walks every API route for a destructured `data` bound to an awaited
 * `supabase...` query and fails if the same destructure doesn't also bind
 * `error`, so a call site can't drop back to reading `data` without checking
 * whether the query actually succeeded.
 */
describe('every supabase query result destructure checks its error', () => {
  const apiDir = join(process.cwd(), 'src/app/api');

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return routeFiles(path);
      return entry.name === 'route.ts' ? [path] : [];
    });
  }

  function rootIsSupabase(node: ts.Expression): boolean {
    let cur: ts.Expression = ts.isAwaitExpression(node) ? node.expression : node;
    while (ts.isCallExpression(cur) || ts.isPropertyAccessExpression(cur)) {
      cur = cur.expression;
    }
    return ts.isIdentifier(cur) && cur.text === 'supabase';
  }

  function bindingName(el: ts.BindingElement, source: ts.SourceFile): string {
    const nameNode = el.propertyName ?? el.name;
    return ts.isIdentifier(nameNode) ? nameNode.getText(source) : '';
  }

  function missingErrorIn(file: string): number[] {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const missing: number[] = [];

    function visit(node: ts.Node) {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isObjectBindingPattern(node.name) &&
        rootIsSupabase(node.initializer)
      ) {
        const names = node.name.elements.map((el) => bindingName(el, source));
        if (names.includes('data') && !names.includes('error')) {
          missing.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
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

  it.each(files.map((f) => [relative(apiDir, f), f]))(
    '%s checks the error on every data destructure',
    (_name, file) => {
      expect(missingErrorIn(file)).toEqual([]);
    },
  );
});
