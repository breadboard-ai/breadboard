/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { makeAction } from "../binder.js";
import { asAction, ActionMode } from "../../coordination.js";
import {
  onWorkbenchEligibilityChange,
  isSingleAgentGraph,
} from "./triggers.js";

export const bind = makeAction();

export const updateWorkbenchEligibility = asAction(
  "Workbench.updateEligibility",
  {
    mode: ActionMode.Immediate,
    triggeredBy: () => onWorkbenchEligibilityChange(bind),
    runOnActivate: true,
  },
  async (): Promise<void> => {
    const { controller, env } = bind;
    const flag = env.flags.get("enableAgentWorkbench");
    const graph = controller.editor.graph.graph;
    controller.editor.workbench.eligible = flag && isSingleAgentGraph(graph);
  }
);

export const setWorkbenchView = asAction(
  "Workbench.setView",
  { mode: ActionMode.Immediate },
  async (view: "workbench" | "classic"): Promise<void> => {
    const { controller } = bind;
    controller.editor.workbench.view = view;
  }
);

export const resizeColumns = asAction(
  "Workbench.resizeColumns",
  { mode: ActionMode.Immediate },
  async (splits: [number, number, number]): Promise<void> => {
    const { controller } = bind;
    controller.editor.workbench.splits = splits;
  }
);
