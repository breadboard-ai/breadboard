/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { PartialPersistentBackend } from "../../engine/file-system/partial-persistent-backend.js";
import { ActionTracker } from "../types/types.js";
import { GuestActionTracker } from "./guest-action-tracker.js";

export { createActionTracker, createActionTrackerBackend };

function createActionTracker(host: OpalShellHostProtocol): ActionTracker {
  return new GuestActionTracker(host);
}

function createActionTrackerBackend() {
  return new PartialPersistentBackend({
    async write(_graphUrl, path, _data) {
      const eventName = path.split("/").at(-1);
      globalThis.gtag?.("event", `step_run_${eventName}`);
    },
  });
}
