/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../strings/helper.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { sideBoardRuntime } from "../contexts/side-board-runtime.js";
import {
  GraphReplaceEvent,
  HideTooltipEvent,
  ShowTooltipEvent,
} from "../events/events.js";
import { fabStyles } from "../styles/fab.js";
import { floatingPanelStyles } from "../styles/floating-panel.js";
import { multiLineInputStyles } from "../styles/multi-line-input.js";
import { SideBoardRuntime } from "../sideboards/types.js";
import { AppCatalystApiClient } from "./app-catalyst.js";
import { FlowGenConstraint, FlowGenerator } from "./flow-generator.js";

const Strings = StringsHelper.forSection("Editor");

type State =
  | { status: "closed" }
  | { status: "open"; abort: AbortController }
  | { status: "generating"; abort: AbortController }
  | { status: "error"; error: unknown; abort: AbortController };

@customElement("bb-flowgen-in-step-button")
export class FlowgenInStepButton extends LitElement {
  static styles = [
    fabStyles,
    floatingPanelStyles,
    multiLineInputStyles,
    css`
      :host {
        position: relative;
        width: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #edit-button {
        width: 100%;
        --bb-icon: var(--bb-add-icon-generative-text-inverted);
      }

      :host([monochrome]) {
        width: 20px;
        height: 20px;

        & #edit-button {
          --background-size: 16px;
          --background-color: var(--bb-neutral-200);
          --background-color-active: var(--bb-neutral-300);
          --box-shadow: none;
          --border-radius: var(--bb-grid-size);
          --bb-icon: var(--bb-add-icon-generative-text);
        }
      }

      #panel {
        position: absolute;
        right: 0;
        width: 340px;
      }
      :host([popoverPosition="above"]) #panel {
        bottom: calc(36px + 8px);
        right: 50%;
        translate: 50% 0;
      }
      :host([popoverPosition="below"]) #panel {
        top: calc(36px + 8px);
      }
      #panel-top {
        display: flex;
        align-items: center;
      }

      #description-input {
        flex: 1;
        min-height: 48px;
      }

      #submit-button {
        width: 24px;
        --bb-icon: var(--bb-add-icon-generative-inverted);
        box-shadow: none;
        background-color: var(--bb-ui-500);
        margin-left: 8px;
      }

      .generating #submit-button {
        background-color: transparent;
        --bb-icon: url(/images/progress-ui.svg);
      }

      #generating-spinner {
        width: 30px;
        aspect-ratio: 1;
        margin-right: 20px;
      }

      #generating-status {
        font-size: 18px;
      }

      #generating-status-detail {
        font-size: 14px;
        margin-top: 8px;
        color: var(--bb-neutral-700);
      }

      #error {
        color: var(--bb-error-color);
        margin-top: 12px;
        overflow: auto;
      }
    `,
  ];

  @consume({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime | undefined;

  @property({ type: Object })
  accessor currentGraph: GraphDescriptor | undefined;

  @property({ type: Object })
  accessor constraint: FlowGenConstraint | undefined;

  @property({ reflect: true })
  accessor popoverPosition: "above" | "below" = "below";

  @property({ reflect: true, type: Boolean })
  accessor monochrome = false;

  @property({})
  accessor label = Strings.from("COMMAND_DESCRIBE_EDIT");

  @state()
  accessor #state: State = { status: "closed" };

  readonly #descriptionInput = createRef<HTMLInputElement>();

  render() {
    switch (this.#state.status) {
      case "closed": {
        return this.#renderEditButton();
      }
      case "open":
      case "generating":
      case "error": {
        return [this.#renderEditButton(), this.#renderPanel()];
      }
      default: {
        this.#state satisfies never;
      }
    }
  }

  #renderEditButton() {
    return html`
      <button
        id="edit-button"
        class="bb-fab"
        @click=${this.#onClickEditButton}
        @pointerover=${this.#onPointerOverEditButton}
        @pointerout=${this.#onPointerOutEditButton}
      >
        ${this.label}
      </button>
    `;
  }

  #renderPanel() {
    return html`
      <div id="panel" class="bb-floating-panel ${this.#state.status}">
        <div id="panel-top">
          <textarea
            id="description-input"
            class="bb-multi-line-input"
            type="text"
            .placeholder=${this.label}
            @keydown=${this.#onInputKeydown}
            ${ref(this.#descriptionInput)}
            ?disabled=${this.#state.status === "generating"}
          ></textarea>

          <button
            id="submit-button"
            class="bb-fab"
            @click=${this.#onClickSubmit}
          ></button>
        </div>

        ${this.#renderErrorIfNeeded()}
      </div>
    `;
  }

  #renderErrorIfNeeded() {
    if (this.#state.status !== "error") {
      return nothing;
    }
    let error = this.#state.error as
      | string
      | { message?: string }
      | { error: { message?: string } | string };
    if (typeof error === "object" && error !== null && "error" in error) {
      // Errors from Breadboard are often wrapped in an {error: <Error>}
      // structure. Unwrap if needed.
      error = error.error;
    }
    let message;
    if (typeof error === "object" && error !== null && "message" in error) {
      message = error.message;
    } else {
      message = String(error);
    }
    return html`<div id="error">${message}</div>`;
  }

  #onClickEditButton() {
    if (this.#state.status === "closed") {
      this.#openPanel();
    } else {
      this.#closePanel();
    }
  }

  async #openPanel() {
    const abort = new AbortController();
    this.#state = { status: "open", abort };
    await this.updateComplete;
    this.#descriptionInput.value?.focus();
    window.addEventListener("click", (event) => this.#onWindowClick(event), {
      signal: abort.signal,
    });
  }

  #closePanel() {
    if (this.#state.status === "closed") {
      return;
    }
    this.#state.abort.abort();
    this.#state = { status: "closed" };
  }

  #onWindowClick(event: MouseEvent) {
    if (this.#state.status === "generating") {
      return;
    }
    for (const target of event.composedPath()) {
      if (target === this) {
        return;
      }
    }
    this.#closePanel();
  }

  #onPointerOverEditButton(event: MouseEvent) {
    this.dispatchEvent(
      new ShowTooltipEvent(this.label, event.clientX, event.clientY)
    );
  }

  #onPointerOutEditButton() {
    this.dispatchEvent(new HideTooltipEvent());
  }

  #onClickSubmit() {
    void this.#generate();
  }

  #onInputKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void this.#generate();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.#closePanel();
    }
  }

  #generate() {
    if (this.#state.status !== "open") {
      return;
    }
    const description = this.#descriptionInput.value?.value;
    if (description) {
      if (!this.currentGraph) {
        this.#onEditError(
          new Error("Internal error: No current graph was available.")
        );
        return;
      }
      this.#state = {
        status: "generating",
        abort: this.#state.abort,
      };
      void this.#editBoard(description, this.currentGraph)
        .then((graph) => this.#onEditComplete(graph))
        .catch((error) => this.#onEditError(error));
    }
  }

  async #editBoard(
    intent: string,
    currentFlow: GraphDescriptor
  ): Promise<GraphDescriptor> {
    if (!this.sideBoardRuntime) {
      throw new Error("Internal error: No side board runtime was available.");
    }
    const generator = new FlowGenerator(
      new AppCatalystApiClient(this.sideBoardRuntime)
    );
    const { flow } = await generator.oneShot({
      intent,
      context: { flow: currentFlow },
      constraint: this.constraint,
    });
    return flow;
  }

  #onEditComplete(graph: GraphDescriptor) {
    if (this.#state.status !== "generating") {
      return;
    }
    this.dispatchEvent(new GraphReplaceEvent(graph, { role: "assistant" }));
    this.#closePanel();
  }

  #onEditError(error: unknown) {
    if (this.#state.status !== "generating") {
      return;
    }
    console.error("Error generating board", error);
    this.#state = {
      status: "error",
      error,
      abort: this.#state.abort,
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-flowgen-in-step-button": FlowgenInStepButton;
  }
}
