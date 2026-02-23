/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Unseen Cast
 *
 * Detects unsafe event casts in SCA action files where an `Event` parameter
 * is unsafely cast to `StateEvent<T>` or `CustomEvent` to extract `.detail`.
 *
 * These casts have zero runtime safety — if the trigger wiring is wrong, you
 * get a silent `undefined` detail. This transform identifies all such sites
 * for review and optionally rewrites them.
 *
 * Patterns detected:
 *
 *   const detail = (evt as StateEvent<"node.change">).detail;
 *   const detail = (evt as CustomEvent)?.detail;
 *   const { intent } = (evt as StateEvent<"flowgen.generate">).detail;
 *
 * Daily Dig #2 — Feb 23, 2026
 */

import { type SourceFile, SyntaxKind } from "ts-morph";

export const description =
  "The Unseen Cast — find unsafe (evt as StateEvent/CustomEvent) casts in action files";

export const include = [
  "packages/visual-editor/src/sca/actions/**/*-actions.ts",
];

interface CastSite {
  file: string;
  line: number;
  text: string;
  castTarget: string;
}

/**
 * Scans a source file for unsafe event casts.
 * In dry-run mode (default), reports findings without modifying anything.
 *
 * Returns true if any cast sites were found.
 */
export function transform(file: SourceFile): boolean {
  const sites: CastSite[] = [];
  const filePath = file.getFilePath();

  // Find all `as` expressions (TypeScript type assertions using `as`)
  const asExpressions = file.getDescendantsOfKind(SyntaxKind.AsExpression);

  for (const asExpr of asExpressions) {
    const typeNode = asExpr.getTypeNode();
    if (!typeNode) continue;

    const typeText = typeNode.getText();

    // Match: (evt as StateEvent<"...">) or (evt as CustomEvent)
    const isStateEvent = typeText.startsWith("StateEvent<");
    const isCustomEvent = typeText === "CustomEvent";

    if (!isStateEvent && !isCustomEvent) continue;

    // Verify this is inside an asAction callback by walking up to find one
    const containingArrow = asExpr.getFirstAncestorByKind(
      SyntaxKind.ArrowFunction
    );
    if (!containingArrow) continue;

    // Check the arrow has an (evt?: Event) style parameter
    const params = containingArrow.getParameters();
    const hasEventParam = params.some((p) => {
      const paramType = p.getType().getText();
      return (
        paramType.includes("Event") &&
        (p.getName() === "evt" ||
          p.getName() === "event" ||
          p.getName() === "e")
      );
    });

    if (!hasEventParam) continue;

    const line = asExpr.getStartLineNumber();
    const statement = asExpr.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    );
    const text = statement
      ? statement.getText().trim()
      : (asExpr.getParent()?.getText().trim() ?? asExpr.getText().trim());

    sites.push({
      file: filePath,
      line,
      text: text.length > 100 ? text.slice(0, 100) + "…" : text,
      castTarget: typeText,
    });
  }

  if (sites.length > 0) {
    const shortPath = filePath.replace(/.*packages\//, "packages/");
    console.log(`   📍 ${shortPath} — ${sites.length} cast(s):`);
    for (const site of sites) {
      console.log(`      L${site.line}: ${site.castTarget}`);
      console.log(`        ${site.text}`);
    }
    console.log();
  }

  // This is a detection-only spike — no rewrites yet.
  // Return false so the runner doesn't count files as "modified".
  return false;
}
