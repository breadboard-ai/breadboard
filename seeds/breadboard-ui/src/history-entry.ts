/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessEventType } from "./types.js";

export class HistoryEntry extends HTMLElement {
  constructor(
    type: HarnessEventType,
    summary: string,
    id = "",
    data: unknown = null,
    elapsedTime: number
  ) {
    super();

    const root = this.attachShadow({ mode: "open" });
    const dataOutput = this.#createDataOutput(data);

    root.innerHTML = `
      <style>
        :host {
          display: block;
          border-top: 1px solid rgb(240, 240, 240);
          padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
          font-size: var(--bb-text-small);
        }

        #container {
          display: flex;
        }

        #container::before {
          content: '';
          box-sizing: border-box;
          width: calc(var(--bb-grid-size) * 4);
          height: calc(var(--bb-grid-size) * 4);
          background: #fff2ccff;
          border: 1px solid #ffab40;
          border-radius: 50%;
          margin-right: calc(var(--bb-grid-size) * 2);
          flex: 0 0 auto;
        }

        #container.load::before {
          background: rgb(90, 64, 119);
          border: 1px solid rgb(90, 64, 119);
        }

        #container.result::before {
          background: #ffa500;
          border: 1px solid #ffa500;
        }

        #container.input::before {
          background: #c9daf8ff;
          border: 1px solid #3c78d8;
        }

        #container.secrets::before {
          background: #f4cccc;
          border: 1px solid #db4437;
        }

        #container.output::before {
          background: #b6d7a8ff;
          border: 1px solid #38761d;
        }

        #container.done::before {
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
          content: '(';
        }

        summary #id:not(:empty)::after {
          content: ')';
        }

        summary #elapsed-time {
          color: #A5A5A5;
        }

        pre {
          white-space: pre-wrap;
        }

      </style>
      <div id="container" class="${type}">
        <details>
          <summary>${summary} <span id="id">${id}</span> <span id="elapsed-time">${this.#formatTime(
      elapsedTime
    )}<span></summary>
          <div><pre>${dataOutput}</pre></div>
        </details>
      </div>
    `;
  }

  #createDataOutput(data: unknown | null) {
    if (data === null) {
      return "No additional data";
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
}
