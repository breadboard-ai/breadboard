/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext } from "@lit/context";

export interface BuildInfo {
  packageJsonVersion: string;
  gitCommitHash: string;
}

export const buildInfoContext = createContext<BuildInfo | undefined>(
  "bb-build-info"
);
