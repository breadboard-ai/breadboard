/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils";
import { EventRoute } from "../types.js";
import * as BreadboardUI from "../../ui/index.js";

export const ChangeRoute: EventRoute<"node.change"> = {
  event: "node.change",

  async do({ runtime, tab, originalEvent, sca }) {
    sca.controller.global.main.blockingAction = true;
    await runtime.edit.changeNodeConfigurationPart(
      tab,
      originalEvent.detail.id,
      originalEvent.detail.configurationPart,
      originalEvent.detail.subGraphId,
      originalEvent.detail.metadata,
      originalEvent.detail.ins
    );
    sca.controller.global.main.blockingAction = false;

    return false;
  },
};

export const MultiChangeRoute: EventRoute<"node.multichange"> = {
  event: "node.multichange",

  async do({ runtime, tab, originalEvent, sca }) {
    if (!tab) {
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    await runtime.edit.multiEdit(
      tab,
      originalEvent.detail.edits,
      originalEvent.detail.description
    );
    sca.controller.global.main.blockingAction = false;

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

export const ChangeEdgeRoute: EventRoute<"node.changeedge"> = {
  event: "node.changeedge",

  async do({ runtime, tab, originalEvent, sca }) {
    sca.controller.global.main.blockingAction = true;
    await runtime.edit.changeEdge(
      tab,
      originalEvent.detail.changeType,
      originalEvent.detail.from,
      originalEvent.detail.to,
      originalEvent.detail.subGraphId
    );
    sca.controller.global.main.blockingAction = false;

    return false;
  },
};

export const ChangeEdgeAttachmentPointRoute: EventRoute<"node.changeedgeattachmentpoint"> =
  {
    event: "node.changeedgeattachmentpoint",

    async do({ runtime, tab, originalEvent, sca }) {
      const { graphId } = originalEvent.detail;

      sca.controller.global.main.blockingAction = true;
      await runtime.edit.changeEdgeAttachmentPoint(
        tab,
        graphId === BreadboardUI.Constants.MAIN_BOARD_ID ? "" : graphId,
        originalEvent.detail.edge,
        originalEvent.detail.which,
        originalEvent.detail.attachmentPoint
      );
      sca.controller.global.main.blockingAction = false;

      return false;
    },
  };

export const ActionRoute: EventRoute<"node.action"> = {
  event: "node.action",

  async do({ runtime, sca, originalEvent }) {
    sca.controller.global.main.blockingAction = true;
    try {
      const project = runtime.state.project;
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
