/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import type { Artifact } from "./artifact-interface.js";

export interface ArtifactStore {
  read(artifactId: string): Promise<Result<Artifact>>;
  write(...artifacts: Artifact[]): Promise<Result<void>>;
}
