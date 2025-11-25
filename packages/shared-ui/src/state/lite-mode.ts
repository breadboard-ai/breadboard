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
  StepListState,
} from "./types";
import { GraphDescriptor } from "@breadboard-ai/types";
import { ReactiveProjectRun } from "./project-run";

export { createLiteModeState };

function createLiteModeState(context: RuntimeContext) {
  return new ReactiveLiteModeState(context);
}

const EXAMPLES: LiteModeIntentExample[] = [
  {
    intent:
      "An app that reads current news and creates an alternative history fiction story based on these news",
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
      "An app that invents a family board game based on the ideas I provide",
  },
];

class ReactiveLiteModeState implements LiteModeState {
  @signal
  accessor status: FlowGenGenerationStatus = "initial";

  @signal
  accessor error: string | undefined;

  startGenerating(): void {
    if (this.stepList) {
      this.stepList.status = "planning";
    }
    this.status = "generating";
  }

  finishGenerating(): void {
    if (this.stepList) {
      this.stepList.status = "ready";
    }
    this.status = "initial";
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

    const { loadState } = this.context.ui;
    switch (loadState) {
      case "Home": {
        const parsedUrl = this.context.router.parsedUrl;
        if (parsedUrl.page === "home") {
          zeroState = !!parsedUrl.new;
          if (zeroState) return "home";
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
    if (!this.stepList || this.empty) return "home";
    return "editor";
  }

  get stepList(): StepListState | undefined {
    return this.context.project?.run.stepList;
  }

  get examples() {
    return EXAMPLES;
  }

  @signal
  accessor currentExampleIntent: string = "";

  constructor(private readonly context: RuntimeContext) {}
}
