/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { MessageTraversalEvent } from "./events.js";

@customElement("bb-traversal-controls")
export class TraversalControls extends LitElement {
  @property({ reflect: true })
  min = 0;

  @property({ reflect: true })
  max = 0;

  @property({ reflect: true })
  value = 0;

  static styles = css`
    :host {
      height: calc(var(--bb-grid-size) * 8);
      display: flex;
      background: #ffffff;
      border: 1px solid #dcdcdc;
      border-radius: calc(var(--bb-grid-size) * 4);
      min-width: calc(var(--bb-grid-size) * 50);
      padding: calc(var(--bb-grid-size) * 1.5);
      align-items: center;
      justify-content: center;
    }

    * {
      box-sizing: border-box;
    }

    input {
      margin: 0 calc(var(--bb-grid-size) * 2);
    }

    button {
      width: 12px;
      height: 12px;
      background: red;
      border-radius: 50%;
      border: none;
      font-size: 0;
    }

    button[disabled] {
      opacity: 0.3;
    }

    #before {
      margin-left: var(--bb-grid-size);
      background: var(--bb-icon-before) center center no-repeat;
    }

    #next {
      background: var(--bb-icon-next) center center no-repeat;
    }

    #value {
      min-width: 60px;
      display: flex;
      background: #d1cbff;
      border-radius: calc(var(--bb-grid-size) * 3);
      font-size: var(--bb-text-small);
      font-weight: bold;
      height: calc(var(--bb-grid-size) * 5);
      align-items: center;
      justify-content: center;
      margin-left: calc(var(--bb-grid-size) * 2);
    }

    #max {
      font-size: var(--bb-text-pico);
      font-weight: normal;
    }
  `;

  #requestPrevious() {
    this.dispatchEvent(new MessageTraversalEvent(this.value - 1));
  }

  #requestNext() {
    this.dispatchEvent(new MessageTraversalEvent(this.value + 1));
  }

  #requestValue(evt: InputEvent) {
    if (!(evt.target instanceof HTMLInputElement)) {
      return;
    }

    this.dispatchEvent(new MessageTraversalEvent(evt.target.valueAsNumber));
  }

  render() {
    return html`<button
        id="before"
        title="Step back"
        ?disabled="${this.value <= this.min}"
        @click=${this.#requestPrevious}
      >
        Back
      </button>
      <input
        @input=${this.#requestValue}
        type="range"
        min=${this.min}
        max=${this.max}
        .value=${this.value}
      />
      <button
        id="next"
        title="Step forward"
        ?disabled=${this.value >= this.max}
        @click=${this.#requestNext}
      >
        Forward
      </button>
      <div id="value">${this.value} / <span id="max">${this.max}</span></div>`;
  }
}
