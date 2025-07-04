/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";

export const ChangeRoute: EventRoute<"node.change"> = {
  event: "node.change",

  async do({ runtime, tab, originalEvent }) {
    await runtime.edit.changeNodeConfigurationPart(
      tab,
      originalEvent.detail.id,
      originalEvent.detail.configurationPart,
      originalEvent.detail.subGraphId,
      originalEvent.detail.metadata,
      originalEvent.detail.ins
    );

    return false;
  },
};
