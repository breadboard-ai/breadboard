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
import { ActionTrackerBase } from "./action-event-sender.js";

export { createActionTracker, createActionTrackerBackend };

function createActionTracker(
  host: OpalShellHostProtocol,
  guestConfiguration: GuestConfiguration,
  measurementId: string | undefined,
  signedInCallback: () => Promise<boolean>
): ActionTracker {
  if (guestConfiguration.supportsActionTracking) {
    console.log("[action tracker] Sending actions to host");
    return new GuestActionTracker(host);
  }
  if (!measurementId) {
    console.log(
      "[action tracker] No measurement ID, using noop action tracker"
    );
    return new NoopActionTracker();
  }
  console.log("[action tracker] Sending actions directly to GA");
  return new GTagActionTracker(measurementId, signedInCallback);
}

function createActionTrackerBackend() {
  return new PartialPersistentBackend({
    async write(_graphUrl, path, _data) {
      const eventName = path.split("/").at(-1);
      globalThis.gtag?.("event", `step_run_${eventName}`);
    },
  });
}

class NoopActionTracker extends ActionTrackerBase {
  constructor() {
    super(() => {
      // Do nothing.
    }, Promise.resolve());
  }
}
  