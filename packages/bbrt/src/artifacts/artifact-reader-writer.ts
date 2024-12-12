/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import type { ArtifactBlob } from "./artifact-interface.js";

export type ArtifactReaderWriter = ArtifactReader & ArtifactWriter;

export interface ArtifactReader {
  read(artifactId: string): Promise<Result<ArtifactBlob>>;
}

export interface ArtifactWriter {
  write(...artifacts: ArtifactBlob[]): Promise<Result<void>>;
}
