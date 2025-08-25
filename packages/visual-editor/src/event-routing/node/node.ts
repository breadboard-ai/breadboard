/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ok } from "@breadboard-ai/utils";
import { EventRoute } from "../types";
import * as BreadboardUI from "@breadboard-ai/shared-ui";

export const AddWithEdgeRoute: EventRoute<"node.addwithedge"> = {
  event: "node.addwithedge",

  async do({ runtime, tab, originalEvent, uiState }) {
    if (!tab) {
      return false;
    }

    uiState.blockingAction = true;
    await runtime.edit.addNodeWithEdge(
      tab,
      originalEvent.detail.node,
      originalEvent.detail.edge,
      originalEvent.detail.subGraphId
    );
    uiState.blockingAction = false;

    runtime.select.selectNodes(
      tab.id,
      runtime.select.generateId(),
      originalEvent.detail.subGraphId ?? BreadboardUI.Constants.MAIN_BOARD_ID,
      [originalEvent.detail.node.id]
    );

    return false;
  },
};

export const ChangeRoute: EventRoute<"node.change"> = {
  event: "node.change",

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.changeNodeConfigurationPart(
      tab,
      originalEvent.detail.id,
      originalEvent.detail.configurationPart,
      originalEvent.detail.subGraphId,
      originalEvent.detail.metadata,
      originalEvent.detail.ins
    );
    uiState.blockingAction = false;

    return false;
  },
};

export const MultiChangeRoute: EventRoute<"node.multichange"> = {
  event: "node.multichange",

  async do({ runtime, tab, originalEvent, uiState }) {
    if (!tab) {
      return false;
    }

    uiState.blockingAction = true;
    await runtime.edit.multiEdit(
      tab,
      originalEvent.detail.edits,
      originalEvent.detail.description
    );
    uiState.blockingAction = false;

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

  async do({ runtime, tab, originalEvent, uiState }) {
    uiState.blockingAction = true;
    await runtime.edit.changeEdge(
      tab,
      originalEvent.detail.changeType,
      originalEvent.detail.from,
      originalEvent.detail.to,
      originalEvent.detail.subGraphId
    );
    uiState.blockingAction = false;

    return false;
  },
};

export const ChangeEdgeAttachmentPointRoute: EventRoute<"node.changeedgeattachmentpoint"> =
  {
    event: "node.changeedgeattachmentpoint",

    async do({ runtime, tab, originalEvent, uiState }) {
      const { graphId } = originalEvent.detail;

      uiState.blockingAction = true;
      await runtime.edit.changeEdgeAttachmentPoint(
        tab,
        graphId === BreadboardUI.Constants.MAIN_BOARD_ID ? "" : graphId,
        originalEvent.detail.edge,
        originalEvent.detail.which,
        originalEvent.detail.attachmentPoint
      );
      uiState.blockingAction = false;

      return false;
    },
  };

export const ActionRoute: EventRoute<"node.action"> = {
  event: "node.action",

  async do({ runtime, tab, uiState, originalEvent }) {
    uiState.blockingAction = true;
    try {
      const project = runtime.state.getOrCreateProjectState(tab?.mainGraphId);
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
      uiState.blockingAction = false;
    }
  },
};
