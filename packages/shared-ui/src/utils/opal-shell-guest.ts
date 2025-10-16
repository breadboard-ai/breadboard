/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";
import * as comlink from "comlink";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";

export const opalShellContext = createContext<OpalShellProtocol | undefined>(
  "OpalShell"
);

export function connectToOpalShellIframeHost(): OpalShellProtocol {
  return comlink.wrap<OpalShellProtocol>(
    comlink.windowEndpoint(
      parent,
      undefined,
      CLIENT_DEPLOYMENT_CONFIG.SHELL_HOST_ORIGIN
    )
  );
}
