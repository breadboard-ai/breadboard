/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OpalShellProtocol {
  ping(): Promise<"pong">;
  fetchWithCreds(url: string): Promise<unknown>;
}
