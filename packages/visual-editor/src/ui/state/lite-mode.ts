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
  LiteModePlannerState,
} from "./types.js";
import { GraphDescriptor } from "@breadboard-ai/types";
import { ReactiveProjectRun } from "./project-run.js";
import { FlowGenerator } from "../flow-gen/flow-generator.js";
import { SCA } from "../../sca/sca.js";

export { createLiteModeState };

function createLiteModeState(context: RuntimeContext, sca: SCA) {
  return new ReactiveLiteModeState(context, sca);
}

const EXAMPLES: LiteModeIntentExample[] = [
  {
    intent:
      "Help me prepare for a quiz on a given topic by creating sample multiple choice questions with hints as an interactive quiz",
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
  get status(): FlowGenGenerationStatus {
    // This is a bit of a hack to allow the non-lite SCA state to drive the
    // generation status for the step list view when used in non-lite mode.
    // Ideally the lite-mode state just gets collapsed into SCA and this
    // all goes away
    const scaStatus = this.sca.controller.global.flowgenInput.state.status;
    if (scaStatus === "generating") return "generating";
    return this.#localStatus;
  }

  @signal
  accessor #localStatus: FlowGenGenerationStatus = "initial";

  @signal
  accessor error: string | undefined;

  startGenerating(): void {
    this.#localStatus = "generating";
  }

  finishGenerating(): void {
    // Consume intent.
    this.#intent = undefined;
    this.currentExampleIntent = "";
    this.#localStatus = "initial";
  }

  @signal
  get intent() {
    if (this.status !== "initial" && this.#intent) return this.#intent;
    return "";
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

    const { loadState } = this.sca.controller.global.main;
    switch (loadState) {
      case "Home": {
        const parsedUrl = this.sca.controller.router.parsedUrl;
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
        return "error";
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
    private readonly sca: SCA
  ) {
    this.planner = new PlannerState(this.context.flowGenerator);
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
