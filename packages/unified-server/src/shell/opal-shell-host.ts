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

function expose() {
  const iframe = document.querySelector("iframe#opal-app" as "iframe");
  if (!iframe?.contentWindow) {
    console.error(`could not find #opal-app iframe`);
    return;
  }
  const impl = new OpalShellProtocolImpl();
  comlink.expose(
    impl,
    comlink.windowEndpoint(
      iframe.contentWindow,
      undefined,
      CLIENT_DEPLOYMENT_CONFIG.SHELL_GUEST_ORIGIN
    )
  );
}

expose();
