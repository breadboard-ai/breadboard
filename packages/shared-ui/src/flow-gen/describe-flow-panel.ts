/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
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

const Strings = StringsHelper.forSection("ProjectListing");

type State =
  | { status: "initial" }
  | { status: "generating" }
  | { status: "error"; error: unknown };

type TemplateFlow = {
  icon: string;
  label: string;
  prompt: string;
};

const TEMPLATE_FLOWS: TemplateFlow[] = [
  {
    label: "Content writer",
    icon: "smart_campaign",
    prompt:
      "Create a flow that takes a business name and description, and generates 1 social media post with an eye-catching picture",
  },
  {
    label: "Research analyst",
    icon: "search_spark",
    prompt:
      "Create a flow that takes a product area, performs research on the web, and produces a report",
  },
  {
    label: "Movie maker",
    icon: "movie",
    prompt:
      "Create a flow that takes a movie description, and generates 3 scene descriptions, along with a storyboard sketch for each.",
  },
  {
    label: "Multi-agent manager",
    icon: "group_auto",
    prompt:
      "Create a flow that takes a task description, divides the task into 3 sub-tasks, assigns them to 3 independent agents, and then combines the result into a report",
  },
];

@customElement("bb-describe-flow-panel")
export class DescribeFlowPanel extends LitElement {
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
      }

      #describe-button {
        --bb-icon: var(--bb-add-icon-generative-text);
        color: inherit;
      }

      bb-expanding-textarea {
        background: #fff;
        flex: 1;
        width: 100%;
        color: var(--bb-neutral-900);
        border-color: var(--bb-neutral-200);
        --submit-button-color: #3271ea;
        --min-lines: 1;
        --max-lines: 6;
        font:
          400 14px "Google Sans",
          sans-serif;
        line-height: 20px;
        caret-color: var(--bb-ui-500);

        &:focus {
          border-color: #3271ea;
          box-shadow: 0px 4px 10.1px 0px rgba(0, 0, 0, 0.1);
        }

        &::part(textarea)::placeholder {
          color: var(--bb-neutral-500);
        }
      }

      #generating-container {
        background: #fff;
        border-radius: 0.5lh;
        padding: 1lh;
        display: flex;
        font:
          400 "Google Sans",
          sans-serif;
        box-shadow: 0px 4px 10.1px 0px rgba(0, 0, 0, 0.1);
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
        margin-top: 8px;
        font-size: 14px;
        color: var(--bb-neutral-500);
      }

      #error {
        color: var(--bb-error-color);
      }

      #chips {
        margin-top: 20px;

        & .bb-chip {
          font-size: 12px;
          color: #3399ff;
          background: #ebf5ff;
        }
      }
    `,
  ];

  @consume({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime | undefined;

  @state()
  accessor #state: State = { status: "initial" };

  readonly #descriptionInput = createRef<ExpandingTextarea>();

  render() {
    switch (this.#state.status) {
      case "initial": {
        return html`
          <bb-expanding-textarea
            ${ref(this.#descriptionInput)}
            .placeholder=${Strings.from("LABEL_PLACEHOLDER_DESCRIPTION")}
            @change=${this.#onInputChange}
          >
          </bb-expanding-textarea>
          ${this.#renderTemplateChips()}
        `;
      }
      case "generating": {
        return html`
          <div id="generating-container">
            <img id="generating-spinner" src="/images/progress-ui.svg" />
            <div>
              <div id="generating-status">
                ${Strings.from("LABEL_GENERATING_FLOW")}
              </div>
              <div id="generating-status-detail">
                ${Strings.from("LABEL_GENERATING_FLOW_DETAIL")}
              </div>
            </div>
          </div>
        `;
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
        return html`<div id="error">${message}</div>`;
      }
      default: {
        this.#state satisfies never;
      }
    }
  }

  #renderTemplateChips() {
    return html`
      <div id="chips">
        ${TEMPLATE_FLOWS.map(
          (chip) => html`
            <button
              class="bb-chip"
              @click=${() => this.#onClickTemplateChip(chip)}
            >
              <span class="g-icon">${chip.icon}</span>
              <span>${chip.label}</span>
            </button>
          `
        )}
      </div>
    `;
  }

  #onClickTemplateChip(flow: TemplateFlow) {
    const input = this.#descriptionInput?.value;
    if (input) {
      input.value = flow.prompt;
      input.focus();
    }
  }

  #onInputChange() {
    const input = this.#descriptionInput.value;
    const description = input?.value;
    if (description) {
      input.value = "";
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
    "bb-describe-flow-panel": DescribeFlowPanel;
  }
}
