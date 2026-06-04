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
import {
  parsePrompt,
  buildPrompt,
  extractPromptText,
  extractInPorts,
} from "./prompt-utils.js";
import { UpdateNode } from "../../../ui/transforms/index.js";
import type { NodeDescriptor } from "@breadboard-ai/types";

export const bind = makeAction();

// =============================================================================
// Helpers
// =============================================================================

/**
 * Finds the single agent node in a workbench-eligible graph.
 * Returns null if the graph isn't a single-agent graph.
 */
function getAgentNode(): NodeDescriptor | null {
  const { controller } = bind;
  const graph = controller.editor.graph.graph;
  if (!isSingleAgentGraph(graph)) return null;
  return graph.nodes[0];
}

/**
 * Applies an updated prompt string to the agent node's configuration.
 *
 * Builds the UpdateNode transform, applies it via the graph editor, and
 * sets `lastNodeConfigChange` so the autoname trigger can react.
 */
async function applyPromptToGraph(
  agentNode: NodeDescriptor,
  newPrompt: string
): Promise<void> {
  const { controller } = bind;
  const editor = controller.editor.graph.editor;
  if (!editor) return;

  const ins = extractInPorts(newPrompt);
  const config = {
    ...agentNode.configuration,
    config$prompt: { role: "user", parts: [{ text: newPrompt }] },
  };

  const transform = new UpdateNode(
    agentNode.id,
    "",
    config,
    agentNode.metadata ?? null,
    ins
  );
  await editor.apply(transform);

  controller.editor.graph.lastNodeConfigChange = {
    nodeId: agentNode.id,
    graphId: "",
    configuration: config,
    titleUserModified: transform.titleUserModified,
  };
}

// =============================================================================
// Triggered Actions
// =============================================================================

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

// =============================================================================
// Direct-Call Actions
// =============================================================================

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

/**
 * Applies updated objective text to the agent node.
 *
 * Preserves the current tool references — only the human-authored text
 * portion of the prompt changes. This is called on blur or Ctrl+Enter
 * from the objective editor.
 */
export const applyObjective = asAction(
  "Workbench.applyObjective",
  { mode: ActionMode.Immediate },
  async (objectiveText: string): Promise<void> => {
    const agentNode = getAgentNode();
    if (!agentNode) return;

    const rawPrompt = extractPromptText(
      agentNode.configuration?.["config$prompt"]
    );
    const { tools } = parsePrompt(rawPrompt);
    const newPrompt = buildPrompt(objectiveText, tools);

    await applyPromptToGraph(agentNode, newPrompt);
  }
);

/**
 * Toggles a tool on or off in the agent node's prompt.
 *
 * Preserves the objective text — only the tool references change.
 * Called from the tool shelf when a toggle switch is flipped.
 */
export const toggleTool = asAction(
  "Workbench.toggleTool",
  { mode: ActionMode.Immediate },
  async (
    toolUrl: string,
    toolTitle: string,
    enabled: boolean
  ): Promise<void> => {
    const agentNode = getAgentNode();
    if (!agentNode) return;

    const rawPrompt = extractPromptText(
      agentNode.configuration?.["config$prompt"]
    );
    const { objectiveText, tools } = parsePrompt(rawPrompt);

    if (enabled) {
      if (!tools.some((t) => t.path === toolUrl)) {
        tools.push({ type: "tool", path: toolUrl, title: toolTitle });
      }
    } else {
      const idx = tools.findIndex((t) => t.path === toolUrl);
      if (idx >= 0) tools.splice(idx, 1);
    }

    const newPrompt = buildPrompt(objectiveText, tools);
    await applyPromptToGraph(agentNode, newPrompt);
  }
);
