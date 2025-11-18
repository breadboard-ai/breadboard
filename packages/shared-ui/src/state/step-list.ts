/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { StepListState, StepListStepState } from "./types";
import { ReactiveProjectRun } from "./project-run";
import { GraphDescriptor, NodeRunStatus } from "@breadboard-ai/types";

export { StepList };

class StepList implements StepListState {
  @signal
  get steps(): Map<string, StepListStepState> {
    return new Map(
      Array.from(this.run.console.entries()).map(([id, entry]) => {
        const prompt = getPrompt(id, this.run.graph);
        const status: StepListStepState["status"] = getStatus(
          entry.status?.status,
          this.planning
        );
        const { icon, title } = entry;
        return [
          id,
          { icon, title, status, prompt } satisfies StepListStepState,
        ];
      })
    );
  }

  @signal
  get intent(): string | null {
    return this.run.graph?.metadata?.intent || null;
  }

  @signal
  get empty(): boolean {
    return (this.run.graph?.nodes.length || 0) === 0;
  }

  @signal
  accessor planning = false;

  @signal
  get graph(): GraphDescriptor | null {
    return this.run.graph || null;
  }

  constructor(private readonly run: ReactiveProjectRun) {}
}

function getPrompt(id: string, graph: GraphDescriptor | undefined): string {
  return (
    graph?.nodes.find((descriptor) => descriptor.id === id)?.metadata
      ?.step_intent || ""
  );
}

function getStatus(
  status: NodeRunStatus | "failed" | undefined,
  planning: boolean
): StepListStepState["status"] {
  if (!status || planning) return "pending";
  switch (status) {
    case "working":
    case "waiting":
      return "working";
    case "ready":
    default:
      return "ready";
  }
}
