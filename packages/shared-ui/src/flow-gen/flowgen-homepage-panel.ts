/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as StringsHelper from "../strings/helper.js";
import { outlineButtonWithIcon } from "../styles/outline-button-with-icon.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { GraphDescriptor } from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { sideBoardRuntime } from "../contexts/side-board-runtime.js";
import { GraphBoardServerGeneratedBoardEvent } from "../events/events.js";
import { SideBoardRuntime } from "../sideboards/types.js";
import type { ExpandingTextarea } from "../elements/input/expanding-textarea.js";
import { icons } from "../styles/icons.js";
import "../elements/input/expanding-textarea.js";
import { chipStyles } from "../styles/chip.js";
import { FlowGenerator } from "./flow-generator.js";
import { AppCatalystApiClient } from "./app-catalyst.js";
import { classMap } from "lit/directives/class-map.js";

const Strings = StringsHelper.forSection("ProjectListing");

type State =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown };

const SUGGESTED_FLOWS = [
  "Create a flow that takes a business name and description, and generates 1 social media post with an eye-catching picture",
  "Create a flow that takes a product area, performs research on the web, and produces a report",
  "Create a flow that takes a movie description, and generates 3 scene descriptions, along with a storyboard sketch for each.",
  "Create a flow that takes a task description, divides the task into 3 sub-tasks, assigns them to 3 independent agents, and then combines the result into a report",
];

@customElement("bb-flowgen-homepage-panel")
export class FlowgenHomepagePanel extends LitElement {
  static styles = [
    outlineButtonWithIcon,
    icons,
    chipStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        margin: 15px 0 0 0;
      }

      #feedback {
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        color: var(--bb-neutral-700);
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
        background: linear-gradient(0deg, #fdf7f8, #f7f9fe);
        border-radius: 100px;
        padding: 10px;
        margin: 20px 0 0 0;
        transition: box-shadow 1s ease-out;
      }

      :host([highlighted]) #gradient-border-container {
        transition: box-shadow 200ms ease-in;
        box-shadow: 0 0 10px 4px rgb(255 0 0 / 20%);
      }

      bb-expanding-textarea {
        flex: 1;
        width: 100%;
        background: #fff;
        color: var(--bb-neutral-900);
        border: none;
        border-radius: 100px;
        padding: 0.5lh 1lh;
        --min-lines: 1;
        --max-lines: 6;
        font: 400 var(--bb-title-small) / var(--bb-title-line-height-small)
          var(--bb-font-family);
        line-height: 20px;
        caret-color: var(--bb-ui-500);

        &::part(textarea)::placeholder {
          color: var(--bb-neutral-500);
        }
        > [slot~="submit"] {
          color: #3271ea;
        }
      }

      #chips {
        margin-top: 20px;

        & .bb-chip {
          font-size: 12px;
          color: #3399ff;
          background: #ebf5ff;
        }
      }

      .spin {
        animation: spin 1.5s linear infinite;
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
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

  @state()
  accessor #state: State = { status: "initial" };

  @property({ reflect: true, type: Boolean })
  accessor highlighted = false;

  @property()
  accessor placeholder =
    SUGGESTED_FLOWS[Math.floor(Math.random() * SUGGESTED_FLOWS.length)];

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
      case "initial": {
        return Strings.from("LABEL_WELCOME_CTA");
      }
      case "generating": {
        return Strings.from("LABEL_GENERATING_FLOW");
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
          .placeholder=${this.placeholder}
          .disabled=${isGenerating}
          @change=${this.#onInputChange}
        >
          <span
            slot="submit"
            class=${classMap({ "g-icon": true, spin: isGenerating })}
            >${isGenerating ? "progress_activity" : "spark"}</span
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
    const generator = new FlowGenerator(
      new AppCatalystApiClient(this.sideBoardRuntime)
    );
    const { flow } = await generator.oneShot({ intent });
    return flow;
  }

  #onGenerateComplete(graph: GraphDescriptor) {
    if (this.#state.status !== "generating") {
      return;
    }
    this.dispatchEvent(
      new GraphBoardServerGeneratedBoardEvent(graph, { role: "assistant" })
    );
  }

  #onGenerateError(error: unknown) {
    if (this.#state.status !== "generating") {
      return;
    }
    console.error("Error generating board", error);
    this.#state = { status: "error", error };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-describe-flow-panel": FlowgenHomepagePanel;
  }
}
