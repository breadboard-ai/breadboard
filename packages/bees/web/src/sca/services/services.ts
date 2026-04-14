/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { BeesAPI } from "./api.js";
import { SSEClient } from "./sse.js";
import { HostCommunicationService } from "./host-communication.js";
import { AgentTreeService } from "./agent-tree-service.js";

import { AppServices } from "../types.js";

let instance: AppServices | null = null;

export function services(): AppServices {
  if (!instance) {
    const stateEventBus = new EventTarget();
    const api = new BeesAPI();
    const sse = new SSEClient(stateEventBus);
    const hostCommunication = new HostCommunicationService(stateEventBus);
    const agentTree = new AgentTreeService(stateEventBus);

    instance = {
      api,
      sse,
      hostCommunication,
      agentTree,
      stateEventBus,
    } satisfies AppServices;
  }

  return instance!;
}
