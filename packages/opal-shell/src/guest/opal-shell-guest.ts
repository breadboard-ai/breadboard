/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/opal-shell/protocol/opal-shell-protocol.js";
import * as comlink from "comlink";
import { createContext } from "@lit/context";

export const opalShellContext = createContext<OpalShellProtocol | undefined>(
  "OpalShell"
);

export function connectToOpalShellIframeHost(): OpalShellProtocol {
  return comlink.wrap<OpalShellProtocol>(comlink.windowEndpoint(parent));
}
