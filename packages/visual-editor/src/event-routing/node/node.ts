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

  async do({ runtime: _runtime, tab, originalEvent, sca }) {
    if (tab?.readOnly) {
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    try {
      await sca.actions.graph.changeNodeConfiguration(
        originalEvent.detail.id,
        originalEvent.detail.subGraphId ?? "",
        originalEvent.detail.configurationPart,
        originalEvent.detail.metadata,
        originalEvent.detail.ins
      );
    } catch (error) {
      console.warn("Failed to change node configuration", error);
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    return false;
  },
};

export const AddRoute: EventRoute<"node.add"> = {
  event: "node.add",

  async do({ runtime, tab, originalEvent, sca }) {
    if (!tab) {
      return false;
    }

    sca.controller.global.main.blockingAction = true;
    try {
      await sca.actions.graph.addNode(
        originalEvent.detail.node,
        originalEvent.detail.graphId
      );

      // Select the new node
      sca.controller.editor.selection.selectNodes([
        originalEvent.detail.node.id,
      ]);

      // Legacy bridge: keep selectionState flowing.
      runtime.select.selectNodes(
        tab.id,
        runtime.select.generateId(),
        originalEvent.detail.graphId || BreadboardUI.Constants.MAIN_BOARD_ID,
        [originalEvent.detail.node.id]
      );
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    return false;
  },
};

export const MoveSelectionRoute: EventRoute<"node.moveselection"> = {
  event: "node.moveselection",

  async do({ originalEvent, sca }) {
    sca.controller.global.main.blockingAction = true;
    try {
      await sca.actions.graph.moveSelectionPositions(
        originalEvent.detail.updates
      );
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    return false;
  },
};

export const ChangeEdgeRoute: EventRoute<"node.changeedge"> = {
  event: "node.changeedge",

  async do({ originalEvent, sca }) {
    sca.controller.global.main.blockingAction = true;
    try {
      await sca.actions.graph.changeEdge(
        originalEvent.detail.changeType,
        originalEvent.detail.from,
        originalEvent.detail.to,
        originalEvent.detail.subGraphId
      );
    } finally {
      sca.controller.global.main.blockingAction = false;
    }

    return false;
  },
};

export const ChangeEdgeAttachmentPointRoute: EventRoute<"node.changeedgeattachmentpoint"> =
  {
    event: "node.changeedgeattachmentpoint",

    async do({ originalEvent, sca }) {
      const { graphId } = originalEvent.detail;

      sca.controller.global.main.blockingAction = true;
      try {
        await sca.actions.graph.changeEdgeAttachmentPoint(
          graphId === BreadboardUI.Constants.MAIN_BOARD_ID ? "" : graphId,
          originalEvent.detail.edge,
          originalEvent.detail.which,
          originalEvent.detail.attachmentPoint
        );
      } finally {
        sca.controller.global.main.blockingAction = false;
      }

      return false;
    },
  };

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
