/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import * as StringsHelper from "../../strings/helper.js";
import { outlineButtonWithIcon } from "../../styles/outline-button-with-icon.js";
import { textInputWithIcon } from "../../styles/text-input-with-icon.js";
import { createRef, ref } from "lit/directives/ref.js";
import GenerateBoard from "@breadboard-ai/shared-ui/bgl/generate-board.bgl.json" with { type: "json" };
import type {
  GraphDescriptor,
  InputValues,
  LLMContent,
  OutputValues,
} from "@breadboard-ai/types";
import { consume } from "@lit/context";
import { sideBoardRuntime } from "../../contexts/side-board-runtime.js";
import { GraphBoardServerGeneratedBoardEvent } from "../../events/events.js";
import { SideBoardRuntime } from "../../sideboards/types.js";

const Strings = StringsHelper.forSection("ProjectListing");

type State =
  | { status: "initial" }
  | { status: "clicked" }
  | { status: "generating" }
  | { status: "error"; error: unknown };

@customElement("bb-describe-flow-panel")
export class DescribeFlowPanel extends LitElement {
  static styles = [
    outlineButtonWithIcon,
    textInputWithIcon,
    css`
      :host {
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--bb-ui-500);
      }

      #describe-button {
        --bb-icon: var(--bb-add-icon-generative-text);
        color: inherit;
      }

      #description-input {
        --bb-icon: var(--bb-add-icon-generative);
        flex: 1;
        max-width: 300px;
        color: inherit;
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
      }
    `,
  ];

  @consume({ context: sideBoardRuntime })
  accessor sideBoardRuntime!: SideBoardRuntime | undefined;

  @state()
  accessor #state: State = { status: "initial" };

  readonly #descriptionInput = createRef<HTMLInputElement>();

  render() {
    switch (this.#state.status) {
      case "initial": {
        return html`
          <button
            id="describe-button"
            class="bb-outline-button-with-icon"
            @click=${this.#onClickDescribeButton}
          >
            ${Strings.from("COMMAND_DESCRIBE_FLOW")}
          </button>
        `;
      }
      case "clicked": {
        return html`
          <input
            ${ref(this.#descriptionInput)}
            id="description-input"
            class="bb-text-input-with-icon"
            type="text"
            @keydown=${this.#onInputKeydown}
          />
        `;
      }
      case "generating": {
        return html`
          <img id="generating-spinner" src="/images/progress-ui.svg" />
          <div>
            <div id="generating-status">
              ${Strings.from("LABEL_GENERATING_FLOW")}
            </div>
            <div id="generating-status-detail">
              ${Strings.from("LABEL_GENERATING_FLOW_DETAIL")}
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

  async #onClickDescribeButton() {
    this.#state = { status: "clicked" };
    await this.updateComplete;
    this.#descriptionInput.value?.focus();
  }

  #onInputKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      const description = this.#descriptionInput.value?.value;
      if (description) {
        this.#state = { status: "generating" };
        void this.#generateBoard(description)
          .then((graph) => this.#onGenerateComplete(graph))
          .catch((error) => this.#onGenerateError(error));
      }
    }
  }

  async #generateBoard(description: string): Promise<GraphDescriptor> {
    if (!this.sideBoardRuntime) {
      throw new Error("Internal error: No side board runtime was available.");
    }
    const runner = await this.sideBoardRuntime.createRunner({
      ...(GenerateBoard as GraphDescriptor),
    });
    const inputs: InputValues & { context: LLMContent[] } = {
      context: [{ parts: [{ text: description }] }],
    };
    const outputs = await new Promise<OutputValues[]>((resolve, reject) => {
      const outputs: OutputValues[] = [];
      runner.addEventListener("input", () => void runner.run(inputs));
      runner.addEventListener("output", (event) =>
        outputs.push(event.data.outputs)
      );
      runner.addEventListener("end", () => resolve(outputs));
      runner.addEventListener("error", (event) => reject(event.data.error));
      void runner.run();
    });
    if (outputs.length !== 1) {
      throw new Error(`Expected 1 output, got ${JSON.stringify(outputs)}`);
    }
    const board = (outputs[0] as { board?: GraphDescriptor }).board;
    if (!board) {
      throw new Error(
        `Expected {"board": <GraphDescriptor>}, got ` +
          JSON.stringify(outputs[0])
      );
    }
    return board;
  }

  #onGenerateComplete(graph: GraphDescriptor) {
    if (this.#state.status !== "generating") {
      return;
    }
    this.dispatchEvent(new GraphBoardServerGeneratedBoardEvent(graph));
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
