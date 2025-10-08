/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpalShellProtocol {
  // TODO(aomarks) Extend this interface and implement. We probably don't need
  // all of the fetch API surface, but it should at least be a compatible subset
  // of it.
  fetchWithCreds(url: string): Promise<unknown>;
}
