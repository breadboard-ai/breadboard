/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HistoryEventType } from "./types.js";

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("bb-history-entry")
export class HistoryEntry extends LitElement {
  @property()
  type: HistoryEventType = HistoryEventType.DONE;

  @state()
  nodeId = "";

  @state()
  summary = "";

  @state()
  data: unknown = null;

  @property()
  elapsedTime = 0;

  static styles = css`
    :host {
      display: block;
      font-size: var(--bb-text-small);
    }

    #container {
      display: flex;
      border-top: 1px solid rgb(240, 240, 240);
      padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 2.5);
    }

    #container summary::before {
      content: "";
      box-sizing: border-box;
      width: calc(var(--bb-grid-size) * 3);
      height: calc(var(--bb-grid-size) * 3);
      background: #fff2ccff;
      border: 1px solid #ffab40;
      border-radius: 50%;
      margin-top: calc(var(--bb-grid-size) * 0.5);
      margin-right: calc(var(--bb-grid-size) * 2);
      flex: 0 0 auto;
      pointer-events: none;
    }

    #container.nodestart summary::before {
      background: radial-gradient(
          var(--bb-progress-color) 0%,
          var(--bb-progress-color) 30%,
          var(--bb-progress-color-faded) 30%,
          var(--bb-progress-color-faded) 50%,
          transparent 50%,
          transparent 100%
        ),
        conic-gradient(transparent 0deg, var(--bb-progress-color) 360deg),
        linear-gradient(
          var(--bb-progress-color-faded),
          var(--bb-progress-color-faded)
        );

      border: none;
      animation: rotate 0.5s linear infinite;
    }

    #container.nodeend summary::before {
      background: var(--bb-progress-color);
      border: 1px solid rgb(90, 64, 119);
    }

    #container.load summary::before {
      background: rgb(90, 64, 119);
      border: 1px solid rgb(90, 64, 119);
    }

    #container.error summary::before {
      background: #cc0000;
      border: 1px solid #cc0000;
    }

    #container.result summary::before {
      background: #ffa500;
      border: 1px solid #ffa500;
    }

    #container.input summary::before {
      background: #c9daf8ff;
      border: 1px solid #3c78d8;
    }

    #container.secrets summary::before {
      background: #f4cccc;
      border: 1px solid #db4437;
    }

    #container.output summary::before {
      background: #b6d7a8ff;
      border: 1px solid #38761d;
    }

    #container.done summary::before {
      background: var(--bb-done-color);
      border: 1px solid var(--bb-done-color);
    }

    details {
      flex: 1;
      list-style: none;
    }

    summary {
      display: flex;
      line-height: calc(var(--bb-grid-size) * 4);
      cursor: pointer;
      user-select: none;
      list-style: none;
    }

    summary::-webkit-details-marker {
      display: none;
    }

    summary #id {
      flex: 1;
      font-style: italic;
      margin-left: var(--bb-grid-size);
    }

    summary #id:not(:empty)::before {
      content: "(";
    }

    summary #id:not(:empty)::after {
      content: ")";
    }

    summary #elapsed-time {
      color: #a5a5a5;
    }

    pre {
      white-space: pre-wrap;
    }

    .history {
      padding-left: calc(var(--bb-grid-size) * 3);
    }

    @keyframes rotate {
      from {
        transform: rotate(0);
      }

      to {
        transform: rotate(360deg);
      }
    }
  `;

  #createDataOutput(data: unknown | null) {
    if (data === null) {
      return "";
    }

    return JSON.stringify(data, null, 2);
  }

  #formatTime(time: number) {
    if (time === 0) {
      return "";
    }

    if (time > 1000) {
      time /= 1000;
      return time.toFixed(2) + "s";
    }

    return time.toFixed(1) + "ms";
  }

  #isOpen(type: HistoryEventType) {
    return (
      type === HistoryEventType.NODESTART || type === HistoryEventType.OUTPUT
    );
  }

  render() {
    return html`<div id="container" class="${this.type}">
    <details ?open=${this.#isOpen(this.type)}>
      <summary>${this.summary} <span id="id">${
      this.nodeId || ""
    }</span> <span id="elapsed-time">${this.#formatTime(
      this.elapsedTime
    )}<span></summary>
    <div class="history"><slot></slot></div>
    <div><pre>${this.#createDataOutput(this.data)}</pre></div>
    </details>
  </div>`;
  }
}
