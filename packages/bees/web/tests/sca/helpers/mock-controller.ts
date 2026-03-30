/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppController } from "../../../src/sca/types.js";
import { GlobalController } from "../../../src/sca/controller/subcontrollers/global.js";
import { ChatController } from "../../../src/sca/controller/subcontrollers/chat.js";
import { StageController } from "../../../src/sca/controller/subcontrollers/stage.js";

export function makeTestController(): { controller: AppController } {
  const controller = {
    global: new GlobalController(),
    chat: new ChatController(),
    stage: new StageController(),
  } as unknown as AppController;

  return { controller };
}
