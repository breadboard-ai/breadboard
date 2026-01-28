/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import {
  FlowGenGenerationStatus,
  LiteModeType,
  LiteModeIntentExample,
  LiteModeState,
  RuntimeContext,
  StepListStepState,
  LiteModePlannerState,
} from "./types.js";
import {
  ConsoleEntry,
  GraphDescriptor,
  LLMContent,
  NodeRunStatus,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import { ReactiveProjectRun } from "./project-run.js";
import { Template } from "@breadboard-ai/utils";
import { FlowGenerator } from "../flow-gen/flow-generator.js";
import { AppController } from "../../sca/controller/controller.js";

export { createLiteModeState };

function createLiteModeState(
  context: RuntimeContext,
  appController: AppController
) {
  return new ReactiveLiteModeState(context, appController);
}

const EXAMPLES: LiteModeIntentExample[] = [
  {
    intent:
      "Help me prepare for a quiz on a given topic by creating sample questions with hints as an interactive quiz",
  },
  {
    intent:
      "Take a photo of the leftovers in the fridge and generate different recipes with photos of the final dish",
  },
  {
    intent:
      "Analyze a meeting transcript and draft an email of the key takeaways and action items",
  },
  {
    intent:
      "An app that takes a given resume and a job description the candidate is interested in, then provides a critique of the resume",
  },
];

class ReactiveLiteModeState implements LiteModeState {
  @signal
  accessor viewError: string = "";

  @signal
  accessor status: FlowGenGenerationStatus = "initial";

  @signal
  accessor error: string | undefined;

  startGenerating(): void {
    this.status = "generating";
  }

  finishGenerating(): void {
    // Consume intent.
    this.#intent = undefined;
    this.currentExampleIntent = "";
    this.status = "initial";
  }

  @signal
  get intent() {
    if (this.status !== "initial" && this.#intent) return this.#intent;
    return "";
  }

  @signal
  get steps(): Map<string, StepListStepState> {
    const run = this.context.project?.run as ReactiveProjectRun;
    if (!run) return new Map();
    return new Map(
      Array.from(run.console.entries()).map(([id, entry]) => {
        const status = getStatus(entry.status?.status, this.status);
        const { icon, title, tags } = entry;
        let prompt: string;
        let label: string;
        if (tags?.includes("input")) {
          prompt = promptFromInput(entry);
          label = labelFromInput(id, run.graph) || "Question from user";
        } else {
          prompt = promptFromIntent(id, run.graph) || "";
          label = "Prompt";
        }
        return [
          id,
          {
            icon,
            title,
            status,
            prompt,
            label,
            tags,
          } satisfies StepListStepState,
        ];
      })
    );
  }

  @signal
  accessor #intent: string | undefined;

  setIntent(intent: string) {
    this.#intent = intent;
  }

  get run(): ReactiveProjectRun | undefined {
    return this.context.project?.run as ReactiveProjectRun;
  }

  get empty(): boolean {
    return (this.run?.graph?.nodes.length || 0) === 0;
  }

  get graph(): GraphDescriptor | null {
    return this.run?.graph || null;
  }

  @signal
  get viewType(): LiteModeType {
    let zeroState = false;

    if (this.viewError) return "error";

    const { loadState } = this.appController.global.main;
    switch (loadState) {
      case "Home": {
        const parsedUrl = this.context.router.parsedUrl;
        if (parsedUrl.page === "home") {
          zeroState = !!parsedUrl.new;
          if (zeroState) return "home";
        }
        // If the URL has a flow but loadState is still "Home", the load
        // action hasn't started yet - treat as "loading" rather than "invalid"
        if (parsedUrl.page === "graph" && parsedUrl.flow) {
          return "loading";
        }
        console.warn("Invalid Home URL state", parsedUrl);
        return "invalid";
      }
      case "Loading":
        if (this.status === "generating") {
          break;
        }
        return "loading";
      case "Error":
        return "invalid";
      case "Loaded": {
        break;
      }
      default:
        console.warn("Unknown UI load state", loadState);
        return "invalid";
    }
    if (this.empty) return "home";
    return "editor";
  }

  get examples() {
    return EXAMPLES;
  }

  @signal
  accessor currentExampleIntent: string = "";

  planner: LiteModePlannerState;

  constructor(
    private readonly context: RuntimeContext,
    private readonly appController: AppController
  ) {
    this.planner = new PlannerState(this.context.flowGenerator);
  }
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
  listStatus: FlowGenGenerationStatus
): StepListStepState["status"] {
  if (!stepStatus || listStatus === "generating") return "pending";
  switch (stepStatus) {
    case "working":
    case "waiting":
      return "working";
    case "ready":
    default:
      return "ready";
  }
}

class PlannerState implements LiteModePlannerState {
  @signal
  get status() {
    return this.flowGenerator.currentStatus || "Creating your app";
  }

  @signal
  get thought() {
    return (
      trimWithEllipsis(
        progressFromThought(this.flowGenerator.currentThought),
        10
      ) || "Planning ..."
    );
  }

  constructor(private readonly flowGenerator: FlowGenerator) {}
}

function progressFromThought(thought: string | null): string | null {
  if (!thought) return null;
  const match = thought.match(/\*\*(.*?)\*\*/);
  return match ? match[1] : null;
}

function trimWithEllipsis(text: string | null, length: number) {
  if (!text) return null;
  const words = text.split(" ");
  if (words.length <= length + 1) return text;
  return words.slice(0, length).join(" ") + "...";
}
