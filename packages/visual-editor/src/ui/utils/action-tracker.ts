/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { ActionTracker } from "../../sca/types.js";
import { GuestActionTracker } from "./guest-action-tracker.js";

export { createActionTracker };

function createActionTracker(host: OpalShellHostProtocol): ActionTracker {
  return new GuestActionTracker(host);
}
