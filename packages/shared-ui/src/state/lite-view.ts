/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import {
  FlowGenGenerationStatus,
  ListViewType,
  LiteViewState,
  RuntimeContext,
  StepListState,
} from "./types";
import { parseUrl } from "../utils/urls";

export { createLiteViewState };

function createLiteViewState(context: RuntimeContext) {
  return new ReactiveLiteViewState(context);
}

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

  @signal
  get viewType(): ListViewType {
    let zeroState = false;

    const { loadState } = this.context.ui;
    switch (loadState) {
      case "Home": {
        const parsedUrl = parseUrl(window.location.href);
        zeroState = !!(parsedUrl.page === "home" && parsedUrl.new);
        if (!zeroState) {
          console.warn("Invalid Home URL state", parsedUrl);
          return "invalid";
        }
        break;
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
    if (zeroState) return "home";
    if (!this.stepList || this.stepList.empty) return "home";
    return "editor";
  }

  get stepList(): StepListState | undefined {
    return this.context.project?.run.stepList;
  }

  constructor(private readonly context: RuntimeContext) {}
}
