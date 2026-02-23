/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import { formatError } from "../../utils/formatting/format-error.js";
import { consume } from "@lit/context";
import { LitElement, css, html, nothing } from "lit";
import { SignalWatcher } from "@lit-labs/signals";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import {
  HideTooltipEvent,
  ModalDismissedEvent,
  ShowTooltipEvent,
  StateEvent,
  UtteranceEvent,
} from "../events/events.js";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import * as StringsHelper from "../strings/helper.js";
import { fabStyles } from "../styles/fab.js";
import { floatingPanelStyles } from "../styles/floating-panel.js";
import { icons } from "../styles/icons.js";
import { multiLineInputStyles } from "../styles/multi-line-input.js";
import { type FlowGenConstraint } from "./flow-generator.js";
import { baseColors } from "../styles/host/base-colors.js";
import { type } from "../styles/host/type.js";

const Strings = StringsHelper.forSection("Editor");

type State =
  | { status: "closed" }
  | { status: "open"; abort: AbortController }
  | { status: "generating"; abort: AbortController }
  | { status: "error"; error: unknown; abort: AbortController };

@customElement("bb-flowgen-in-step-button")
export class FlowgenInStepButton extends SignalWatcher(LitElement) {
  static styles = [
    fabStyles,
    floatingPanelStyles,
    multiLineInputStyles,
    icons,
    baseColors,
    type,
    css`
      :host {
        position: relative;
        width: var(--bb-grid-size-9);
        height: var(--bb-grid-size-9);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #edit-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        margin: 0 var(--bb-grid-size);
        padding: 0;
        margin: 0;
        border: none;
        background: light-dark(var(--ui-custom-o-10), var(--ui-custom-o-30));
        border-radius: 50%;
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);

        > * {
          pointer-events: none;
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover,
          &:focus {
            background: var(--ui-custom-o-20);
          }
        }
      }

      #panel {
        position: absolute;
        right: 0;
        width: calc(100cqw - var(--bb-grid-size-16));
        max-width: 320px;
        border-radius: var(--bb-grid-size-9);
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
        right: calc(var(--bb-grid-size-3) * -1);
      }

      #panel-top {
        display: flex;
        align-items: center;
        border-radius: var(--bb-grid-size-7);
        border: 1px solid transparent;
        background: var(--light-dark-n-100);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-3);

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
          margin-right: var(--bb-grid-size-2);
        }

        & textarea {
          max-height: 4lh;
          scrollbar-width: none;
          background: transparent;
          border: none;
          outline: none;
          field-sizing: content;
          box-sizing: border-box;
          padding: 0;
          margin: var(--bb-grid-size-2);
        }

        &:focus-within {
          outline: 1px solid var(--ui-custom-o-100);
        }

        & #submit-button {
          display: flex;
          align-items: center;
          box-shadow: none;
          border: none;
          margin: 0;
          padding: 0;
          background-color: transparent;
          color: var(--light-dark-n-70);

          & .g-icon {
            font-size: 30px;
            width: 30px;
            height: 30px;

            &::before {
              content: "send";
            }
          }
        }

        &:has(textarea:invalid) #submit-button .g-icon::before {
          color: var(--light-dark-n-90);
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
        color: var(--light-dark-n-40);
      }

      #error {
        color: var(--light-dark-e-40);
        margin: var(--bb-grid-size-2);
        overflow: auto;
      }
    `,
  ];

  @consume({ context: scaContext })
  accessor sca!: SCA;

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

  @state()
  accessor #showConfirmation = false;

  readonly #descriptionInput = createRef<HTMLInputElement>();

  render() {
    const modal = this.#showConfirmation
      ? html`<bb-global-edit-confirmation-modal
          @bbmodaldismissed=${(evt: ModalDismissedEvent) => {
            this.#showConfirmation = false;

            if (evt.withSave) {
              this.sca.controller.global.flowgenInput.seenConfirmationDialog = true;

              const description = this.#descriptionInput.value?.value;
              if (description && this.currentGraph) {
                this.#proceedWithEdit(description, this.currentGraph);
              }
            }
          }}
        ></bb-global-edit-confirmation-modal>`
      : nothing;

    switch (this.#state.status) {
      case "closed": {
        return [this.#renderEditButton(), modal];
      }
      case "open":
      case "generating":
      case "error": {
        return [this.#renderEditButton(), this.#renderPanel(), modal];
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
          <textarea
            id="description-input"
            class="bb-multi-line-input sans-flex md-body-medium round"
            type="text"
            .placeholder=${this.label}
            required
            @keydown=${this.#onInputKeydown}
            ${ref(this.#descriptionInput)}
            ?disabled=${this.#state.status === "generating"}
          ></textarea>

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

          <button id="submit-button" @click=${this.#onClickSubmit}>
            <span class="g-icon filled round"></span>
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
    const message = formatError(this.#state.error);
    return html`<div id="error" class="sans-flex round md-body-small">
      ${message}
    </div>`;
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
    if (this.#state.status === "closed") {
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

      // Check if this is the first time the user is making a suggested edit
      const seenConfirmationDialog =
        this.sca.controller.global.flowgenInput.seenConfirmationDialog;
      const graphIsEmpty =
        this.sca.controller.editor.graph.graphContentState === "empty";

      if (!seenConfirmationDialog && !graphIsEmpty) {
        this.#showConfirmation = true;

        return;
      }

      // User has already confirmed or graph is empty, proceed directly
      this.#proceedWithEdit(description, this.currentGraph);
    }
  }

  #proceedWithEdit(description: string, graph: GraphDescriptor) {
    if (this.#state.status === "closed") {
      // Reopen the panel if it was closed
      const abort = new AbortController();
      this.#state = {
        status: "generating",
        abort,
      };
    } else {
      this.#state = {
        status: "generating",
        abort: this.#state.abort,
      };
    }
    void this.#editBoard(description, graph)
      .then((graph) => this.#onEditComplete(graph))
      .catch((error) => this.#onEditError(error));
  }

  async #editBoard(
    intent: string,
    currentFlow: GraphDescriptor
  ): Promise<GraphDescriptor> {
    const flowGenerator = this.sca.services.flowGenerator;
    if (!flowGenerator) {
      throw new Error(`No FlowGenerator was provided`);
    }
    const generated = await flowGenerator.oneShot({
      intent,
      context: { flow: currentFlow },
      constraint: this.constraint,
    });
    if ("error" in generated) {
      throw new Error(generated.error);
    }
    return generated.flow;
  }

  #onEditComplete(graph: GraphDescriptor) {
    if (this.#state.status !== "generating") {
      return;
    }
    // This event is necessary to clear the editing state in the
    // enclosing component (entity-editor).
    this.dispatchEvent(new CustomEvent("bbgraphreplace"));
    this.dispatchEvent(
      new StateEvent({
        eventType: "board.replace",
        replacement: graph,
        creator: { role: "assistant" },
      })
    );
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
