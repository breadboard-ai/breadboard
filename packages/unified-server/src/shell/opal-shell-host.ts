/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { CLIENT_DEPLOYMENT_CONFIG } from "@breadboard-ai/shared-ui/config/client-deployment-configuration.js";
import type { OpalShellProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import * as comlink from "comlink";

class OpalShellProtocolImpl implements OpalShellProtocol {
  async ping() {
    console.debug("opal shell host received ping");
    return "pong" as const;
  }

  async fetchWithCreds(_url: string): Promise<unknown> {
    // TODO(aomarks) Implement.
    throw new Error("Not yet implemented");
  }
}

const guestOrigin = CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN;
if (guestOrigin && guestOrigin !== "*") {
  const iframe = document.querySelector("iframe#opal-app" as "iframe");
  if (iframe?.contentWindow) {
    comlink.expose(
      new OpalShellProtocolImpl(),
      comlink.windowEndpoint(
        // Where this host sends messages.
        iframe.contentWindow,
        // Where this host receives messages from.
        window,
        // Constrain origins this host can communicate with, at the postMessage
        // layer. It would otherwise default to all origins.
        // https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#targetorigin
        guestOrigin
      ),
      // Constrain origins this host can communicate with, at the comlink layer.
      // It would otherwise default to all origins. Note this is technically
      // redundant, because we already constrained origins at the postMessage
      // layer.
      // https://github.com/GoogleChromeLabs/comlink?tab=readme-ov-file#comlinkwrapendpoint-and-comlinkexposevalue-endpoint-allowedorigins
      [guestOrigin]
    );
  } else {
    console.error(`could not find #opal-app iframe`);
  }
}
