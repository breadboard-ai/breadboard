/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventRoute } from "../types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

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

export const MultiChangeRoute: EventRoute<"node.multichange"> = {
  event: "node.multichange",

  async do({ runtime, tab, originalEvent }) {
    if (!tab) {
      return false;
    }

    await runtime.edit.multiEdit(
      tab,
      originalEvent.detail.edits,
      originalEvent.detail.description
    );

    const additions: string[] = originalEvent.detail.edits
      .map((edit) => (edit.type === "addnode" ? edit.node.id : null))
      .filter((item) => item !== null);
    if (additions.length === 0) {
      return false;
    }

    runtime.select.selectNodes(
      tab.id,
      runtime.select.generateId(),
      originalEvent.detail.subGraphId ?? BreadboardUI.Constants.MAIN_BOARD_ID,
      additions
    );
    return false;
  },
};
