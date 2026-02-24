/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { consume } from "@lit/context";
import { formatError } from "../../utils/formatting/format-error.js";
import { LitElement, type PropertyValues, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref } from "lit/directives/ref.js";

import "../elements/input/expanding-textarea.js";
import type { ExpandingTextarea } from "../elements/input/expanding-textarea.js";
import { StateEvent, UtteranceEvent } from "../events/events.js";

import * as StringsHelper from "../strings/helper.js";
import { baseColors } from "../styles/host/base-colors.js";
import { type } from "../styles/host/type.js";
import { icons } from "../styles/icons.js";
import { spinAnimationStyles } from "../styles/spin-animation.js";
import { SignalWatcher } from "@lit-labs/signals";
import { scaContext } from "../../sca/context/context.js";
import { type SCA } from "../../sca/sca.js";
import type { FlowgenInputStatus } from "../../sca/controller/subcontrollers/global/flowgen-input-controller.js";

const Strings = StringsHelper.forSection("Editor");

@customElement("bb-flowgen-editor-input")
export class FlowgenEditorInput extends SignalWatcher(LitElement) {
  static styles = [
    icons,
    baseColors,
    type,
    spinAnimationStyles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        max-width: 540px;
        margin: 0 var(--bb-grid-size-2);

        --placeholder-color: var(--n-50);
      }

      #dismiss-button {
        background: none;
        border: none;
        color: var(--light-dark-n-90);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0;
        margin-left: var(--bb-grid-size-5);
      }

      .dismiss-button:hover {
        color: var(--light-dark-n-80);
      }

      p {
        word-break: auto-phrase;
      }

      #feedback {
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        color: var(--light-dark-n-90);
        transition: var(--color-transition);
        background: var(--light-dark-n-20);
        border-radius: var(--bb-grid-size-2);
        padding-left: var(--bb-grid-size-5);
        padding-right: var(--bb-grid-size-5);
        word-break: auto-phrase;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        margin-bottom: var(--bb-grid-size-4);
        max-height: 400px;
        overflow-y: auto;

        > *:not(button) {
          user-select: text;
        }
      }

      #dismiss-button {
        position: sticky;
        top: var(--bb-grid-size-2);
        margin-top: var(--bb-grid-size-2);
        align-self: flex-start;
      }

      .error details {
        margin-top: var(--bb-grid-size-2);
      }

      .error details summary {
        cursor: pointer;
        color: var(--light-dark-n-70);
        font-size: 0.9em;
      }

      .suggestion-label {
        display: block;
        margin-top: var(--bb-grid-size-2);
        font-weight: 500;
      }

      .suggested-prompt {
        display: block;
        background: var(--light-dark-n-30);
        border-left: 3px solid var(--ui-custom-o-100);
        padding: var(--bb-grid-size-3);
        margin: var(--bb-grid-size-2) 0;
        border-radius: var(--bb-grid-size);
        font-style: italic;
      }

      .use-suggestion-button {
        display: block;
        margin-top: var(--bb-grid-size-2);
        background: var(--ui-custom-o-100);
        color: var(--light-dark-n-100);
        border: none;
        border-radius: var(--bb-grid-size-2);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        cursor: pointer;
        font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        transition: background 0.2s ease;
      }

      .use-suggestion-button:hover {
        background: var(--ui-custom-o-80);
      }

      #gradient-border-container {
        flex: 1;
        display: flex;
        align-items: center;
        width: 100%;
        background: light-dark(var(--ui-custom-o-10), var(--ui-custom-o-30));
        border-radius: var(--bb-grid-size-10);
        padding: var(--bb-grid-size-3);
      }

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
        margin: 0 var(--bb-grid-size-2);
      }

      bb-expanding-textarea {
        flex: 1;
        width: 100%;
        color: var(--light-dark-n-0);
        transition: var(--color-transition);
        background: var(--light-dark-n-100);
        border: none;
        border-radius: var(--bb-grid-size-7);
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        --min-lines: 1;
        --max-lines: 4;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        line-height: 1lh;
        caret-color: var(--light-dark-n-0);

        &:focus-within {
          outline: 1px solid var(--ui-custom-o-100);
        }

        > [slot~="submit"] {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          color: light-dark(var(--n-70), var(--n-40));
          font-size: 30px;
          width: 30px;
          height: 30px;
          transition: color 0.2s ease;
          cursor: default;
          pointer-events: none;

          &.active {
            color: light-dark(var(--n-0), var(--n-100)) !important;
            cursor: pointer;
            pointer-events: auto;
          }
        }

        &::part(textarea)::placeholder {
          color: var(--placeholder-color);
          transition: var(--color-transition);
        }
      }
    `,
  ];

  @consume({ context: scaContext })
  accessor sca!: SCA;

  /**
   * Get state from controller (signal-backed for cross-breakpoint sync).
   */
  get #state(): FlowgenInputStatus {
    return this.sca.controller.global.flowgenInput.state;
  }

  /**
   * Set state on controller.
   */
  set #state(value: FlowgenInputStatus) {
    this.sca.controller.global.flowgenInput.state = value;
  }

  /**
   * Get input value from controller.
   */
  get #inputValue(): string {
    return this.sca.controller.global.flowgenInput.inputValue;
  }

  /**
   * Set input value on controller.
   */
  set #inputValue(value: string) {
    this.sca.controller.global.flowgenInput.inputValue = value;
  }

  @property({ type: Boolean, reflect: true })
  accessor focused = false;

  @property({ type: Boolean, reflect: true })
  accessor generating = false;

  get #hasEmptyGraph() {
    return this.sca.controller.editor.graph.graphContentState !== "loaded";
  }

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property({ type: Boolean })
  accessor hasInputText = false;

  #lastStatus: FlowgenInputStatus["status"] = "initial";

  readonly #descriptionInput = createRef<ExpandingTextarea>();

  override render() {
    const feedback = html` <div id="feedback">
      <p>${this.#renderFeedback()}</p>
      <button id="dismiss-button" @click=${this.#onClearError}>&#215</button>
    </div>`;
    return [
      this.#renderFeedback() == nothing ? nothing : feedback,
      this.#renderInput(),
    ];
  }

  override async updated(changes: PropertyValues) {
    const currentStatus = this.#state.status;
    if (this.#lastStatus === "generating" && currentStatus === "initial") {
      if (this.#descriptionInput.value) {
        this.#descriptionInput.value.value = "";
        this.#inputValue = "";
        this.hasInputText = false;
      }
    }

    if (changes.has("#state") && this.#state.status === "error") {
      this.#descriptionInput.value?.focus();
      this.highlighted = true;
      setTimeout(() => (this.highlighted = false), 2500);
    }

    this.#lastStatus = currentStatus;
  }

  #renderFeedback() {
    switch (this.#state.status) {
      case "initial":
      case "generating": {
        return nothing;
      }
      case "error": {
        const message = formatError(this.#state.error);

        // Check for "Feel free to try this instead: '...' Validation" pattern
        const suggestionMatch = message.match(
          /Feel free to try this instead:\s*'(.+?)'\s*Validation/
        );
        if (suggestionMatch) {
          const suggestedPrompt = suggestionMatch[1];
          const beforeSuggestion = message.slice(
            0,
            message.indexOf("Feel free to try this instead:")
          );
          const afterSuggestion = message.slice(
            message.indexOf(suggestionMatch[0]) + suggestionMatch[0].length
          );
          return html`
            <span class="error">
              ${beforeSuggestion.trim()}
              <span class="suggestion-label"
                >Feel free to try this instead:</span
              >
              <span class="suggested-prompt">${suggestedPrompt}</span>
              <button
                class="use-suggestion-button"
                @click=${() => this.#useSuggestedPrompt(suggestedPrompt)}
              >
                Use suggested prompt
              </button>
              ${afterSuggestion.trim()
                ? html`<details>
                    <summary>Show details</summary>
                    Validation${afterSuggestion}
                  </details>`
                : nothing}
            </span>
          `;
        }

        return html`<span class="error">${message}</span>`;
      }
      default: {
        this.#state satisfies never;
      }
    }
  }

  #useSuggestedPrompt(prompt: string) {
    if (this.#descriptionInput.value) {
      this.#descriptionInput.value.value = prompt;
    }
    this.#state = { status: "initial" };
    // Trigger generation with the new prompt
    this.#onInputChange();
  }

  #renderInput() {
    const isGenerating = this.#state.status === "generating";
    return html`
      <div id="gradient-border-container">
        <bb-expanding-textarea
          ${ref(this.#descriptionInput)}
          .disabled=${isGenerating}
          .value=${this.#inputValue}
          .placeholder=${this.#hasEmptyGraph
            ? Strings.from("COMMAND_DESCRIBE_FRESH_FLOW")
            : Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
          @input=${this.#onInputSync}
          @change=${this.#onInputChange}
          @focus=${this.#onInputFocus}
          @blur=${this.#onInputBlur}
        >
          <bb-speech-to-text
            slot="mic"
            @bbutterance=${(evt: UtteranceEvent) => {
              if (!this.#descriptionInput.value) {
                return;
              }

              this.#descriptionInput.value.value = evt.parts
                .map((part) => part.transcript)
                .join("");
            }}
          ></bb-speech-to-text>
          <span
            slot="submit"
            class=${classMap({
              "g-icon": true,
              filled: true,
              round: true,
              spin: isGenerating,
              active: this.hasInputText || isGenerating,
            })}
            >${isGenerating ? "progress_activity" : "send"}</span
          >
        </bb-expanding-textarea>
      </div>
    `;
  }

  #onInputChange() {
    const input = this.#descriptionInput.value;
    const description = input?.value;
    if (description) {
      if (description === "/force generating") {
        this.#state = { status: "generating" };
        return;
      } else if (description === "/force initial") {
        this.#state = { status: "initial" };
        return;
      }

      // Dispatch StateEvent - event-router handles locking/tracking,
      // SCA action handles core logic. This survives DOM changes during resize.
      // Note: projectState may be undefined if context hasn't propagated yet;
      // the event route has a fallback to runtime.project.
      this.dispatchEvent(
        new StateEvent({
          eventType: "flowgen.generate",
          intent: description,
        })
      );
    }
  }

  #onClearError() {
    this.#state = { status: "initial" };
  }

  /**
   * Sync input value to controller on every keystroke.
   */
  #onInputSync() {
    const input = this.#descriptionInput.value;
    if (input) {
      this.#inputValue = input.value;
      this.hasInputText = input.value.trim().length > 0;
    }
  }

  #onInputFocus() {
    this.focused = true;
  }

  #onInputBlur() {
    this.focused = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-flowgen-editor-input": FlowgenEditorInput;
  }
}
