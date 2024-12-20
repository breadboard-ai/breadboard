/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type Artifact = ArtifactHandle | ArtifactBlob;

export interface ArtifactHandle {
  id: string;
  kind: "handle";
  mimeType: string;
}

export interface ArtifactBlob {
  id: string;
  kind: "blob";
  blob: Blob;
}
