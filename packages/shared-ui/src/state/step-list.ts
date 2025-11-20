/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { StepListState, StepListStateStatus, StepListStepState } from "./types";
import { ReactiveProjectRun } from "./project-run";
import {
  ConsoleEntry,
  GraphDescriptor,
  LLMContent,
  NodeRunStatus,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { Template } from "@breadboard-ai/utils";

export { StepList };

class StepList implements StepListState {
  @signal
  get steps(): Map<string, StepListStepState> {
    return new Map(
      Array.from(this.run.console.entries()).map(([id, entry]) => {
        const status: StepListStepState["status"] = getStatus(
          entry.status?.status,
          this.status
        );
        const { icon, title, tags } = entry;
        let prompt: string;
        let label: string;
        if (tags?.includes("input")) {
          prompt = promptFromInput(entry);
          label = labelFromInput(id, this.run.graph) || "Question from user";
        } else {
          prompt = promptFromIntent(id, this.run.graph) || "";
          label = "Prompt";
        }
        return [
          id,
          { icon, title, status, prompt, label } satisfies StepListStepState,
        ];
      })
    );
  }

  @signal
  get intent(): string | null {
    return this.run.graph?.metadata?.intent || null;
  }

  @signal
  accessor status: StepListStateStatus = "ready";

  constructor(private readonly run: ReactiveProjectRun) {}
}

function promptFromInput(entry: ConsoleEntry) {
  return (
    (
      entry.output.values().next().value?.parts.at(0) as
        | TextCapabilityPart
        | undefined
    )?.text || ""
  );
}

function promptFromIntent(
  id: string,
  graph: GraphDescriptor | undefined
): string | undefined {
  const node = graph?.nodes.find((descriptor) => descriptor.id === id);
  if (!node) return;

  const intent = node.metadata?.step_intent;
  if (intent) return intent;

  const { configuration } = node;
  if (!configuration) return;

  // Fall back to the full prompt
  const generatePrompt = textFromLLMContent(node.configuration?.config$prompt);
  if (generatePrompt) return generatePrompt;

  return textFromLLMContent(node.configuration?.text);
}

function textFromLLMContent(o: unknown): string | undefined {
  const c = o as LLMContent | undefined;
  const text = (c?.parts.at(0) as TextCapabilityPart | undefined)?.text;
  if (!text) return;

  return new Template(text).preview;
}

function labelFromInput(
  id: string,
  graph: GraphDescriptor | undefined
): string | undefined {
  const configuration = graph?.nodes.find(
    (descriptor) => descriptor.id === id
  )?.configuration;
  if (!configuration) return;

  return textFromLLMContent(configuration.description);
}

function getStatus(
  stepStatus: NodeRunStatus | "failed" | undefined,
  listStatus: StepListStateStatus
): StepListStepState["status"] {
  if (!stepStatus || listStatus === "planning") return "pending";
  switch (stepStatus) {
    case "working":
    case "waiting":
      return "working";
    case "ready":
    default:
      return "ready";
  }
}
