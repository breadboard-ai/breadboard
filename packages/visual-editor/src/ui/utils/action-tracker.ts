/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GuestConfiguration,
  OpalShellHostProtocol,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { PartialPersistentBackend } from "../../engine/file-system/partial-persistent-backend.js";
import { ActionTracker } from "../types/types.js";
import { GTagActionTracker } from "./gtag-action-tracker.js";
import { GuestActionTracker } from "./guest-action-tracker.js";

export { createActionTracker, createActionTrackerBackend };

function createActionTracker(
  host: OpalShellHostProtocol,
  guestConfiguration: GuestConfiguration,
  measurementId: string | undefined
): ActionTracker {
  if (guestConfiguration.supportsActionTracking) {
    return new GuestActionTracker(host);
  }
  if (!measurementId) {
    throw new Error("Measurement ID is required for GTagActionTracker");
  }
  return new GTagActionTracker(measurementId);
}

function createActionTrackerBackend() {
  return new PartialPersistentBackend({
    async write(_graphUrl, path, _data) {
      const eventName = path.split("/").at(-1);
      globalThis.gtag?.("event", `step_run_${eventName}`);
    },
  });
}
