/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppController } from "../../../src/sca/types.js";
import { AgentTreeController } from "../../../src/sca/controller/subcontrollers/agent-tree.js";
import { GlobalController } from "../../../src/sca/controller/subcontrollers/global.js";
import { ChatController } from "../../../src/sca/controller/subcontrollers/chat.js";
import { StageController } from "../../../src/sca/controller/subcontrollers/stage.js";

export function makeTestController(): { controller: AppController } {
  const controller = {
    agentTree: new AgentTreeController(),
    global: new GlobalController(),
    chat: new ChatController(),
    stage: new StageController(),
  } as unknown as AppController;

  return { controller };
}
