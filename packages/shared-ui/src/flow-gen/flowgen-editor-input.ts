/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, type PropertyValues, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../strings/helper.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { sideBoardRuntime } from "../contexts/side-board-runtime.js";
import { GraphReplaceEvent } from "../events/events.js";
import { SideBoardRuntime } from "../sideboards/types.js";
import type { ExpandingTextarea } from "../elements/input/expanding-textarea.js";
import { icons } from "../styles/icons.js";
import "../elements/input/expanding-textarea.js";
import { FlowGenerator } from "./flow-generator.js";
import { AppCatalystApiClient } from "./app-catalyst.js";
import { classMap } from "lit/directives/class-map.js";
import { spinAnimationStyles } from "../styles/spin-animation.js";

const Strings = StringsHelper.forSection("Editor");

type State =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown };

@customElement("bb-flowgen-editor-input")
export class FlowgenEditorInput extends LitElement {
  static styles = [
    icons,
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
        width: 360px;

        --color-transition: color 100ms;
        --input-color: #24369c92;
        --placeholder-color: #919bcd;
        --icon-color: #b6c2ff;
      }
      :host([focused]),
      :host([generating]) {
        --input-color: #24379c;
        --placeholder-color: #919bcd;
        --icon-color: #0c57d0;
      }

      #feedback {
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        color: var(--bb-neutral-700);
        transition: var(--color-transition);
        background: var(--bb-neutral-50);
        padding: 0;
        word-break: break-all;

        > .error {
          color: var(--bb-warning-500);
        }
      }

      #gradient-border-container {
        flex: 1;
        display: flex;
        width: 100%;
        background: linear-gradient(0deg, #f4f0f3, #e8eef7);
        border-radius: 100px;
        padding: 10px;
        transition: box-shadow 1s ease-out;
      }
      :host([focused]) #gradient-border-container,
      :host([generating]) #gradient-border-container {
        transition: box-shadow 150ms ease-in;
        box-shadow: 0 0 10px 1px rgb(0 0 0 / 15%);
      }
      :host([highlighted]) #gradient-border-container {
        transition: box-shadow 200ms ease-in;
        box-shadow: 0 0 10px 4px rgb(255 0 0 / 20%);
      }

      bb-expanding-textarea {
        flex: 1;
        width: 100%;
        color: var(--input-color);
        transition: var(--color-transition);
        background: #fff;
        border: none;
        border-radius: 100px;
        padding: 8px 16px;
        --min-lines: 1;
        --max-lines: 3;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        line-height: 20px;
        caret-color: var(--input-color);

        &::part(textarea)::placeholder {
          color: var(--placeholder-color);
          transition: var(--color-transition);
        }

        > [slot~="submit"] {
          color: var(--icon-color);
          transition: var(--color-transition);
        }
      }

      .g-icon {
        font-variation-settings:
          "FILL" 0,
          "wght" 600,
          "GRAD" 0,
          "opsz" 48;
      }
    `,
  ];

  @consume({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime | undefined;

  @property({ type: Object })
  accessor currentGraph: GraphDescriptor | undefined;

  @state()
  accessor #state: State = { status: "initial" };

  @property({ type: Boolean, reflect: true })
  accessor focused = false;

  @property({ type: Boolean, reflect: true })
  accessor generating = false;

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  readonly #descriptionInput = createRef<ExpandingTextarea>();

  override render() {
    return [
      html`<p id="feedback">${this.#renderFeedback()}</p>`,
      this.#renderInput(),
    ];
  }

  override async updated(changes: PropertyValues) {
    if (changes.has("#state") && this.#state.status === "error") {
      this.#descriptionInput.value?.focus();
      this.highlighted = true;
      setTimeout(() => (this.highlighted = false), 2500);
    }
  }

  #renderFeedback() {
    switch (this.#state.status) {
      case "initial":
      case "generating": {
        return nothing;
      }
      case "error": {
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
        return html`<span class="error">${message}</span>`;
      }
      default: {
        this.#state satisfies never;
      }
    }
  }

  #renderInput() {
    const isGenerating = this.#state.status === "generating";
    return html`
      <div id="gradient-border-container">
        <bb-expanding-textarea
          ${ref(this.#descriptionInput)}
          .disabled=${isGenerating}
          .placeholder=${Strings.from("COMMAND_DESCRIBE_EDIT_FLOW")}
          .tabCompletesPlaceholder=${false}
          @change=${this.#onInputChange}
          @focus=${this.#onInputFocus}
          @blur=${this.#onInputBlur}
        >
          <span
            slot="submit"
            class=${classMap({ "g-icon": true, spin: isGenerating })}
            >${isGenerating ? "progress_activity" : "pen_spark"}</span
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
      this.#state = { status: "generating" };
      void this.#generateBoard(description)
        .then((graph) => this.#onGenerateComplete(graph))
        .catch((error) => this.#onGenerateError(error));
    }
  }

  async #generateBoard(intent: string): Promise<GraphDescriptor> {
    if (!this.sideBoardRuntime) {
      throw new Error("Internal error: No side board runtime was available.");
    }
    this.generating = true;
    const generator = new FlowGenerator(
      new AppCatalystApiClient(this.sideBoardRuntime)
    );
    const { flow } = await generator.oneShot({
      intent,
      context: { flow: this.currentGraph },
    });
    return flow;
  }

  #onGenerateComplete(graph: GraphDescriptor) {
    if (this.#state.status !== "generating") {
      return;
    }
    this.dispatchEvent(new GraphReplaceEvent(graph, { role: "assistant" }));
    this.#state = { status: "initial" };
    this.#clearInput();
    this.generating = false;
  }

  #onGenerateError(error: unknown) {
    if (this.#state.status !== "generating") {
      return;
    }
    console.error("Error generating board", error);
    this.#state = { status: "error", error };
    this.generating = false;
  }

  #clearInput() {
    if (this.#descriptionInput.value) {
      this.#descriptionInput.value.value = "";
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
