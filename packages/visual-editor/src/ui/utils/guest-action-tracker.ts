/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import { ActionTrackerBase } from "./action-event-sender.js";

export { GuestActionTracker };

class GuestActionTracker extends ActionTrackerBase {
  constructor(host: OpalShellHostProtocol) {
    super(
      (action, params) => host.trackAction(action, params),
      Promise.resolve()
    );
  }
}
