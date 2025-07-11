/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import {
  GraphReplaceEvent,
  HideTooltipEvent,
  ShowTooltipEvent,
  UtteranceEvent,
} from "../events/events.js";
import * as StringsHelper from "../strings/helper.js";
import { fabStyles } from "../styles/fab.js";
import { floatingPanelStyles } from "../styles/floating-panel.js";
import { icons } from "../styles/icons.js";
import { multiLineInputStyles } from "../styles/multi-line-input.js";
import {
  flowGeneratorContext,
  type FlowGenConstraint,
  type FlowGenerator,
} from "./flow-generator.js";
import { colorsLight } from "../styles/host/colors-light.js";

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
    icons,
    colorsLight,
    css`
      :host {
        position: relative;
        width: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #edit-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 34px;
        margin: 0 var(--bb-grid-size);
        padding: 0 0 0 6px;
        margin: 0;
        border: none;
        background: var(--n-98);
        border-radius: var(--bb-grid-size-16) var(--bb-grid-size-5)
          var(--bb-grid-size-5) var(--bb-grid-size-16);
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background: var(--n-95);
          }
        }
      }

      #panel {
        position: absolute;
        right: 0;
        width: calc(100cqw - var(--bb-grid-size-16));
        max-width: 320px;
        border-radius: var(--bb-grid-size-8);
        padding: var(--bb-grid-size-3);
        background: var(--ui-flowgen-step);
      }

      :host([popoverPosition="above"]) #panel {
        bottom: var(--bb-grid-size-8);
        right: 50%;
        translate: 50% 0;
      }

      :host([popoverPosition="below"]) #panel {
        top: var(--bb-grid-size-7);
        right: -22px;
      }

      #panel-top {
        display: flex;
        align-items: center;
        border-radius: var(--bb-grid-size-5);
        border: 1px solid transparent;
        background: var(--bb-neutral-0);

        bb-speech-to-text {
          --button-size: var(--bb-grid-size-8);
          --alpha-adjustment: 0;
          --background-color: transparent;
          --active-color: linear-gradient(
            rgb(177, 207, 250) 0%,
            rgb(198, 210, 243) 34%,
            rgba(210, 212, 237, 0.4) 69%,
            rgba(230, 217, 231, 0) 99%
          );
          margin-left: 2px;
          margin-right: var(--bb-grid-size);
        }

        & textarea {
          min-height: var(--bb-grid-size-9);
          background: transparent;
          border: none;
          outline: none;
          field-sizing: content;
          box-sizing: border-box;
          padding: var(--bb-grid-size-2) var(--bb-grid-size-2)
            var(--bb-grid-size-2) 0;
          font: 400 var(--bb-body-medium) / var(--bb-body-line-height-medium)
            var(--bb-font-family);
        }

        &:focus-within {
          outline: 1px solid var(--ui-custom-o-100);
        }

        & #submit-button {
          display: flex;
          align-items: center;

          box-shadow: none;
          border: none;
          margin: 0 8px;
          padding: 0;
          background-color: transparent;
          color: var(--bb-ui-500);

          & .g-icon::before {
            content: "send_spark";
          }
        }

        &:has(textarea:invalid) #submit-button .g-icon::before {
          content: "pen_spark";
        }
      }

      #description-input {
        flex: 1;
      }

      .generating #panel-top #submit-button {
        background: url(/images/progress-ui.svg) center center / 20px 20px
          no-repeat;
        cursor: pointer;

        & .g-icon {
          opacity: 0;
        }
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

  @consume({ context: flowGeneratorContext })
  accessor flowGenerator: FlowGenerator | undefined = undefined;

  @property({ type: Object })
  accessor currentGraph: GraphDescriptor | undefined;

  @property({ type: Object })
  accessor constraint: FlowGenConstraint | undefined;

  @property({ reflect: true })
  accessor popoverPosition: "above" | "below" = "below";

  @property({ reflect: true, type: Boolean })
  accessor monochrome = false;

  @property({})
  accessor label = Strings.from("COMMAND_DESCRIBE_EDIT_FLOW");

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
        @click=${this.#onClickEditButton}
        @pointerover=${this.#onPointerOverEditButton}
        @pointerout=${this.#onPointerOutEditButton}
      >
        <span class="g-icon round filled w-500">pen_spark</span>
      </button>
    `;
  }

  #renderPanel() {
    return html`
      <div id="panel" class="${this.#state.status}">
        <div id="panel-top">
          <bb-speech-to-text
            @bbutterance=${(evt: UtteranceEvent) => {
              if (!this.#descriptionInput.value) {
                return;
              }

              this.#descriptionInput.value.value = evt.parts
                .map((part) => part.transcript)
                .join("");
            }}
          ></bb-speech-to-text>
          <textarea
            id="description-input"
            class="bb-multi-line-input"
            type="text"
            .placeholder=${this.label}
            required
            @keydown=${this.#onInputKeydown}
            ${ref(this.#descriptionInput)}
            ?disabled=${this.#state.status === "generating"}
          ></textarea>

          <button id="submit-button" @click=${this.#onClickSubmit}>
            <span class="g-icon"></span>
          </button>
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
    if (!this.flowGenerator) {
      throw new Error(`No FlowGenerator was provided`);
    }
    const { flow } = await this.flowGenerator.oneShot({
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
