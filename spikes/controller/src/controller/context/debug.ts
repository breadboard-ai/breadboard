/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { DebugEntry } from "../types";

export const debugContextPaths = new Map();
export const debugContextValues = new Map<string, DebugEntry>();
export const debugGlobalLogLevel: {
  levels: {
    verbose: boolean;
    info: boolean;
    warnings: boolean;
    errors: boolean;
  };
  activeTags: Set<string>;
  availableTags: Set<string>;
} = {
  levels: {
    verbose: false,
    info: true,
    warnings: true,
    errors: true,
  },
  activeTags: new Set(),
  availableTags: new Set(),
};
