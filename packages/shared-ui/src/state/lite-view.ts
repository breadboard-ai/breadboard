/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import {
  FlowGenGenerationStatus,
  ListViewType,
  LiteViewExample,
  LiteViewState,
  RuntimeContext,
  StepListState,
} from "./types";
import { parseUrl } from "../utils/urls";
import { GraphDescriptor } from "@breadboard-ai/types";
import { ReactiveProjectRun } from "./project-run";

export { createLiteViewState };

function createLiteViewState(context: RuntimeContext) {
  return new ReactiveLiteViewState(context);
}

const EXAMPLES: LiteViewExample[] = [
  {
    intent:
      "An app that reads current news and creates an alternative fiction story based on these news",
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

class ReactiveLiteViewState implements LiteViewState {
  @signal
  accessor status: FlowGenGenerationStatus = "initial";

  @signal
  accessor error: string | undefined;

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
  get viewType(): ListViewType {
    let zeroState = false;

    const { loadState } = this.context.ui;
    switch (loadState) {
      case "Home": {
        const parsedUrl = parseUrl(window.location.href);
        if (parsedUrl.page === "home") {
          if (parsedUrl.remix) return "loading";
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
