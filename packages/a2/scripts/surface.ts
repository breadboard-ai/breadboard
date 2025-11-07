/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Surface {
  surfaceId: string;
  description: string;
  surfaceSpec: string;
  dataModelSpec: string;
  exampleData: string;
  dataModelSchema: string;
  responseSchema: string;
}

export interface ParsedSurfaces {
  surfaces: Surface[];
}
