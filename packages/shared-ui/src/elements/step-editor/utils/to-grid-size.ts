/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GRID_SIZE } from "../constants";

export function toGridSize(value: number) {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}
