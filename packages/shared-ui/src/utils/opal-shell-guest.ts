/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { createContext } from "@lit/context";
import * as comlink from "comlink";
import { CLIENT_DEPLOYMENT_CONFIG } from "../config/client-deployment-configuration.js";
import { OAuthBasedOpalShell } from "./oauth-based-opal-shell.js";

export const opalShellContext = createContext<OpalShellProtocol | undefined>(
  "OpalShell"
);

export function connectToOpalShellHost(): OpalShellProtocol {
  const hostOrigin = CLIENT_DEPLOYMENT_CONFIG.SHELL_HOST_ORIGIN;
  if (hostOrigin && hostOrigin !== "*") {
    return comlink.wrap<OpalShellProtocol>(
      comlink.windowEndpoint(
        // Where this guest sends messages.
        window.parent,
        // Where this guest receives messages from.
        window,
        // Constrain origins this guest can send messages to, at the postMessage
        // layer. It would otherwise default to all origins.
        //
        // https://github.com/GoogleChromeLabs/comlink?tab=readme-ov-file#comlinkwrapendpoint-and-comlinkexposevalue-endpoint-allowedorigins
        // https://github.com/GoogleChromeLabs/comlink/blob/114a4a6448a855a613f1cb9a7c89290606c003cf/src/comlink.ts#L594C26-L594C38
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin
        hostOrigin
      )
    );
  } else {
    // TODO(aomarks) Remove once we are fully migrated to the iframe
    // arrangement.
    return new OAuthBasedOpalShell();
  }
}
