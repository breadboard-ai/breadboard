/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * FIXME: Legacy node event route. This still depends on the legacy runtime
 * (runtime.project.run) which is not yet available through SCA services.
 * Migrate to SCA node-actions.ts (using stateEventTrigger) once the runtime
 * dependency is resolved, then delete this file.
 */

import { ok } from "@breadboard-ai/utils";
import { EventRoute } from "../types.js";

// FIXME: Migrate to SCA action (blocked on legacy runtime dependency)
export const ActionRoute: EventRoute<"node.action"> = {
  event: "node.action",

  async do({ runtime, sca, originalEvent }) {
    sca.controller.global.main.blockingAction = true;
    try {
      const project = runtime.project;
      if (!project) {
        console.warn(`No project for "node.action"`);
        return false;
      }
      const acting = await project.run.handleUserAction(originalEvent.payload);
      if (!ok(acting)) {
        console.warn(acting.$error);
        return false;
      }
      return false;
    } finally {
      sca.controller.global.main.blockingAction = false;
    }
  },
};
