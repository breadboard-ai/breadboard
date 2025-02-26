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

const Strings = StringsHelper.forSection("ProjectListing");

type State =
  | { status: "initial" }
  | { status: "clicked" }
  | { status: "generating"; description: string };

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
        color: #3271ea;
      }
      #describe-button {
        --bb-icon: var(--bb-icon-pen-spark);
        color: inherit;
      }
      #description-input {
        --bb-icon: var(--bb-icon-spark);
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
    `,
  ];

  @state()
  accessor #state: State = { status: "initial" };

  #descriptionInput = createRef<HTMLInputElement>();

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
        return html`<img
            id="generating-spinner"
            src="/images/progress-ui.svg"
          />
          <div>
            <div id="generating-status">
              ${Strings.from("LABEL_GENERATING_FLOW")}
            </div>
            <div id="generating-status-detail">
              ${Strings.from("LABEL_GENERATING_FLOW_DETAIL")}
            </div>
          </div>`;
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
        this.#state = { status: "generating", description };
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-describe-flow-panel": DescribeFlowPanel;
  }
}
