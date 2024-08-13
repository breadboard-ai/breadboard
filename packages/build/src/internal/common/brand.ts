/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * A global symbol used for annotating the types of objects in the Breadboard
 * Build package.
 *
 * Compared to `instanceof` checks, branding with a global symbol allows type
 * recognition even across two versions of the same package (which is not
 * uncommon in the npm world).
 */
export const brand = Symbol.for("breadboard-brand");

/**
 * Check whether an object has the given branding.
 * @see {@link brand}.
 */
export function isBranded(value: unknown, branding: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [brand]?: string })[brand] === branding
  );
}
