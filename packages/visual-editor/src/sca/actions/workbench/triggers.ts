/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signalTrigger, type SignalTrigger } from "../../coordination.js";
import { type ActionBind } from "../binder.js";
import type { GraphDescriptor } from "@breadboard-ai/types";

function isSingleAgentGraph(graph: GraphDescriptor | null): boolean {
  if (!graph) return false;
  const nodes = graph.nodes;
  if (!nodes || nodes.length !== 1) return false;
  return nodes[0].type === "agent";
}

export enum WorkbenchEligibility {
  ELIGIBLE = "eligible",
  INELIGIBLE = "ineligible",
}

export function onWorkbenchEligibilityChange(bind: ActionBind): SignalTrigger {
  return signalTrigger("Workbench Eligibility Change", () => {
    const { controller, env } = bind;
    const flag = env.flags.get("enableAgentWorkbench");
    const graph = controller.editor.graph.graph;
    const eligible = flag && isSingleAgentGraph(graph);
    return eligible
      ? WorkbenchEligibility.ELIGIBLE
      : WorkbenchEligibility.INELIGIBLE;
  });
}
