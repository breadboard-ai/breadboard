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
    id: string | null = null,
    data: unknown = null,
    elapsedTime: number
  ) {
    super();

    const root = this.attachShadow({ mode: "open" });
    const dataOutput = this.#createDataOutput(data);
    const idOutput = id || "";

    root.innerHTML = `
      <style>
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
          content: '';
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

        #container.progress summary::before {
          background: radial-gradient(
            var(--bb-progress-color) 0%,
            var(--bb-progress-color) 30%,
            var(--bb-progress-color-faded) 30%,
            var(--bb-progress-color-faded) 50%,
            transparent 50%,
            transparent 100%
          ),
            conic-gradient(
              transparent 0deg,
              var(--bb-progress-color) 360deg
            ),
            linear-gradient(
              var(--bb-progress-color-faded),
              var(--bb-progress-color-faded)
            );

          border: none;
          animation: rotate 0.5s linear infinite;
        }

        :host(:not(:first-child)) #container.progress {
          display: none;
        }

        #container.load summary::before {
          background: rgb(90, 64, 119);
          border: 1px solid rgb(90, 64, 119);
        }

        #container.error summary::before {
          background: #CC0000;
          border: 1px solid #CC0000;
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

        @keyframes rotate {
          from {
            transform: rotate(0);
          }
        
          to {
            transform: rotate(360deg);
          }
        }

      </style>
      <div id="container" class="${type}">
        <details ${type === "output" ? "open" : ""}>
          <summary>${summary} <span id="id">${idOutput}</span> <span id="elapsed-time">${this.#formatTime(
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
