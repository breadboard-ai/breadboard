/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export function typesMatch(initial: unknown, loaded: unknown): boolean {
  if (initial === null || initial === undefined) return true;
  if (loaded === null || loaded === undefined) return true;

  if (typeof initial !== typeof loaded) return false;

  // Enforce strict symmetry for container types.
  // If one is a Map/Set/Array, the other must be too.
  if (initial instanceof Map !== loaded instanceof Map) return false;
  if (initial instanceof Set !== loaded instanceof Set) return false;
  if (Array.isArray(initial) !== Array.isArray(loaded)) return false;

  return true;
}
