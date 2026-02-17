/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Node action event route. Sets the node action request on the SCA
 * RunController, which triggers the `executeNodeAction` action via
 * `onNodeActionRequested`.
 */

import { EventRoute } from "../types.js";

export const ActionRoute: EventRoute<"node.action"> = {
  event: "node.action",

  async do({ sca, originalEvent }) {
    const { nodeId, actionContext } = originalEvent.payload;
    if (!actionContext) return false;
    // Event uses "console" for step-list context; SCA uses "step".
    const mapped = actionContext === "console" ? "step" : actionContext;
    sca.controller.run.main.setNodeActionRequest({
      nodeId,
      actionContext: mapped,
    });
    return false;
  },
};
