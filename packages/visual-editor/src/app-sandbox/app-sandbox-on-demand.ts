/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { OnDemandUI } from "@breadboard-ai/types";
import { AppSandboxOnDemandCallbackMessage } from "./app-sandbox-protocol.js";
import { scriptifyFunction } from "./app-sandbox-scriptify.js";

export { buildOnDemandScript };

/**
 * Builds a `<script>` tag that, when injected before the generated HTML,
 * listens for `DOMContentLoaded` and then calls `window.renderUI(input, cb)`.
 * The callback fires a `postMessage` back to the host with the result.
 */
function buildOnDemandScript(onDemandInfo: OnDemandUI): string {
  const inputJson = JSON.stringify(onDemandInfo.input);
  return scriptifyFunction(() => {
    // Wait for DOMContentLoaded so the generated HTML's scripts have run
    // and window.renderUI is defined.
    window.addEventListener("DOMContentLoaded", () => {
      const renderUI = (
        window as unknown as {
          renderUI?: (
            input: unknown,
            callback: (result: unknown) => void
          ) => void;
        }
      ).renderUI;
      if (typeof renderUI !== "function") {
        console.error("[on-demand-ui] window.renderUI not found");
        return;
      }
      const input = JSON.parse("__ON_DEMAND_INPUT_JSON__");
      renderUI(input, (result: unknown) => {
        window.parent.postMessage(
          {
            type: "app-sandbox-on-demand-callback",
            result: result as Record<string, unknown>,
          } satisfies AppSandboxOnDemandCallbackMessage,
          "__PARENT_ORIGIN_TO_BE_REPLACED__"
        );
      });
    });
  }, [
    ["__PARENT_ORIGIN_TO_BE_REPLACED__", window.location.origin],
    [
      "__ON_DEMAND_INPUT_JSON__",
      inputJson.replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
    ],
  ]);
}
