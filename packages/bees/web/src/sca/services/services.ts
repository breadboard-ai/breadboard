/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BeesAPI } from "./api.js";
import { SSEClient } from "./sse.js";
import { HostCommunicationService } from "./host-communication.js";

import { AppServices } from "../types.js";

let instance: AppServices | null = null;

export function services(): AppServices {
  if (!instance) {
    const stateEventBus = new EventTarget();
    const api = new BeesAPI();
    const sse = new SSEClient(stateEventBus);
    const hostCommunication = new HostCommunicationService(stateEventBus);

    instance = {
      api,
      sse,
      hostCommunication,
      stateEventBus,
    } satisfies AppServices;
  }

  return instance!;
}
