/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";

export class OAuthBasedOpalShell implements OpalShellProtocol {
  async ping() {
    console.debug("opal shell host received ping");
    return "pong" as const;
  }

  async fetchWithCreds(_url: string): Promise<unknown> {
    // TODO(aomarks) Implement.
    throw new Error("Not yet implemented");
  }
}
