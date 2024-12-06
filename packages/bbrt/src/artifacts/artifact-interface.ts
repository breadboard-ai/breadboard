/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Artifact = BlobArtifact;

export interface BlobArtifact {
  id: string;
  kind: "blob";
  blob: Blob;
  // TODO(aomarks) Provenance (e.g. which board).
}

export interface ArtifactHandle {
  id: string;
  mimeType: string;
}
