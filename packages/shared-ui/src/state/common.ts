/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { idFromPath };

function idFromPath(path: number[]): string {
  return `e-${path.join("-")}`;
}
