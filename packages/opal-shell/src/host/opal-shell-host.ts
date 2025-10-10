/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OpalShellProtocol } from "@breadboard-ai/opal-shell/protocol/opal-shell-protocol.js";
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
  comlink.expose(impl, comlink.windowEndpoint(iframe.contentWindow));
}

expose();
