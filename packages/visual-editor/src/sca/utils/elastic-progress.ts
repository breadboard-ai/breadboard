/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { getElasticProgress };

/**
 * Calculates an elastic progress value that becomes asymptotically slower
 * after a certain threshold ('knee'), ensuring it never reaches 1.0.
 *
 * @param rawFraction - The actual linear progress (time elapsed / expected duration).
 * @param knee - The point (0.0 - 1.0) where linear progress ends and elasticity begins. Default 0.75.
 * @param stretch - How "sticky" the final stretch is. Higher = faster initial approach to 99%. Default 5.0.
 */
function getElasticProgress(
  rawFraction: number,
  knee: number = 0.75,
  stretch: number = 5.0
): number {
  if (rawFraction <= knee) {
    // Linear phase: returns exact progress up to the knee.
    return rawFraction;
  }

  // Elastic phase: Map infinite remaining time into the remaining UI space.
  // We calculate how far past the knee we are.
  const overtime = rawFraction - knee;
  // We calculate how much UI space is left (e.g., the final 25%).
  const remainingUI = 1.0 - knee;

  // Exponential decay formula to asymptotically approach 1.0
  return 1.0 - remainingUI * Math.exp(-overtime * stretch);
}
