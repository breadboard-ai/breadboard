/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 *
 * @title Breadboard Manifest
 */

export interface BreadboardManifest {
  $schema?: string;
  boards: Board[];
  manifests: NestedManifest[];
}

export interface Board {
  title?: string;
  url: string;
  version?: string;
}

export interface NestedManifest {
  title?: string;
  url: string;
}

export default BreadboardManifest;
