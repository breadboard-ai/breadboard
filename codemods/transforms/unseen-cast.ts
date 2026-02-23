/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The Unseen Cast
 *
 * Detects and rewrites unsafe event casts in SCA action files where an `Event`
 * parameter is unsafely cast to `StateEvent<T>` or `CustomEvent` to extract
 * `.detail`.
 *
 * These casts have zero runtime safety — if the trigger wiring is wrong, you
 * get a silent `undefined` detail. This transform:
 *
 * 1. Narrows the parameter type from `Event` to the specific event type
 * 2. Replaces the cast expression with a direct property access
 *
 * Before:
 *   async (evt?: Event): Promise<void> => {
 *     const detail = (evt as StateEvent<"node.change">).detail;
 *
 * After:
 *   async (evt?: StateEvent<"node.change">): Promise<void> => {
 *     const detail = evt!.detail;
 *
 * Daily Dig #2 — Feb 23, 2026
 */

import {
  type SourceFile,
  type ArrowFunction,
  SyntaxKind,
  type AsExpression,
} from "ts-morph";

export const description =
  "The Unseen Cast — rewrite unsafe (evt as StateEvent/CustomEvent) casts";

export const include = [
  "packages/visual-editor/src/sca/actions/**/*-actions.ts",
];

interface CastSite {
  asExpr: AsExpression;
  castType: string; // full type text, e.g. StateEvent<"node.change">
  isOptionalChain: boolean; // true if ?.detail (CustomEvent pattern)
}

/**
 * Rewrites unsafe event casts in action callbacks.
 *
 * For each arrow function with `evt?: Event` that contains a
 * StateEvent or CustomEvent cast:
 *   1. Change parameter type: `evt?: Event` → `evt?: StateEvent<"...">`
 *   2. Replace cast: `(evt as StateEvent<"...">).detail` → `evt!.detail`
 *      or: `(evt as CustomEvent)?.detail` → `evt?.detail`
 */
export function transform(file: SourceFile): boolean {
  const filePath = file.getFilePath();
  const asExpressions = file.getDescendantsOfKind(SyntaxKind.AsExpression);

  // Collect cast sites grouped by their containing arrow function.
  const arrowMap = new Map<ArrowFunction, CastSite[]>();

  for (const asExpr of asExpressions) {
    const typeNode = asExpr.getTypeNode();
    if (!typeNode) continue;

    const typeText = typeNode.getText();
    const isStateEvent = typeText.startsWith("StateEvent<");
    const isCustomEvent = typeText === "CustomEvent";
    if (!isStateEvent && !isCustomEvent) continue;

    // Must be inside an arrow function with an `evt` parameter.
    const arrow = asExpr.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    if (!arrow) continue;

    const evtParam = arrow.getParameters().find((p) => {
      const name = p.getName();
      return name === "evt" || name === "event" || name === "e";
    });
    if (!evtParam) continue;

    // Check current param type includes Event.
    const paramType = evtParam.getType().getText();
    if (!paramType.includes("Event")) continue;

    // Detect optional chaining: (evt as CustomEvent)?.detail
    const paren = asExpr.getParentIfKind(SyntaxKind.ParenthesizedExpression);
    const grandparent = paren?.getParent();
    const isOptionalChain =
      grandparent?.getKind() === SyntaxKind.PropertyAccessExpression &&
      grandparent.getText().includes("?.");

    if (!arrowMap.has(arrow)) {
      arrowMap.set(arrow, []);
    }
    arrowMap.get(arrow)!.push({ asExpr, castType: typeText, isOptionalChain });
  }

  if (arrowMap.size === 0) return false;

  const shortPath = filePath.replace(/.*packages\//, "packages/");

  // Process each arrow function (bottom-up to preserve positions).
  const arrows = [...arrowMap.entries()].reverse();

  for (const [arrow, sites] of arrows) {
    if (!arrow) continue;

    const evtParam = arrow.getParameters().find((p) => {
      const name = p.getName();
      return name === "evt" || name === "event" || name === "e";
    })!;

    const paramName = evtParam.getName();

    // Use the first cast's type for the parameter annotation.
    const newParamType = sites[0].castType;

    // 1. Rewrite each cast expression (bottom-up within the arrow).
    const reversedSites = [...sites].reverse();
    for (const { asExpr, isOptionalChain } of reversedSites) {
      const paren = asExpr.getParentIfKind(SyntaxKind.ParenthesizedExpression);
      if (!paren) continue;

      // Capture line number before replacement invalidates the node.
      const line = paren.getStartLineNumber();

      // Replace `(evt as StateEvent<"...">)` or `(evt as CustomEvent)` with
      // `evt!` (for non-optional) or `evt` (for optional chain ?.detail).
      //
      // When the original uses optional chaining `?.detail`, we replace with
      // just `evt` because the `?.` is on the property access, not the paren.
      // The parent PropertyAccessExpression already has `?.`.
      if (isOptionalChain) {
        paren.replaceWithText(paramName);
      } else {
        paren.replaceWithText(`${paramName}!`);
      }

      console.log(
        `   ✏️  ${shortPath}:${line} — ${newParamType} → typed parameter`
      );
    }

    // 2. Update the parameter type annotation.
    evtParam.setType(newParamType);
  }

  return true;
}
