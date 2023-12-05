/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { StartEvent } from "./events.js";

export type StartArgs = {
  boards: {
    title: string;
    url: string;
  }[];
};

export class Start extends HTMLElement {
  static observedAttributes = ["url"];

  constructor({ boards }: StartArgs) {
    super();
    const root = this.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        #sample-board-list {
          width: auto;
          max-width: 30vw;
          padding: calc(var(--bb-grid-size) * 2) calc(var(--bb-grid-size) * 4);
          border-radius: 30px;
          background: rgb(255, 255, 255);
          border: 1px solid rgb(200, 200, 200);
        }

        .sample-board {
          background-color: rgb(249, 250, 253);
          border-radius: 120px;
          border: none;
          color: rgba(0, 0, 0, 0.4);
          cursor: pointer;
          display: block;
          font-size: var(--bb-text-medium);
          height: calc(var(--bb-grid-size, 4px) * 9);
          margin-bottom: calc(var(--bb-grid-size, 4px) * 2);
          overflow: hidden;
          padding: calc(var(--bb-grid-size, 4px) * 2);
          padding-left: calc(var(--bb-grid-size, 4px) * 12);
          position: relative;
          text-align: left;
          text-overflow: ellipsis;
          transition: color var(--bb-easing-duration-out) var(--bb-easing),
            background-color var(--bb-easing-duration-out) var(--bb-easing);
          white-space: nowrap;
          width: 100%;
        }

        .sample-board[disabled] {
          cursor: default;
        }

        .sample-board::before {
          background: var(--bb-icon-board) center center no-repeat;
          content: '';
          height: 24px;
          left: calc(var(--bb-grid-size, 4px) * 3 + 2px);
          opacity: 0.4;
          pointer-events: none;
          position: absolute;
          top: calc(var(--bb-grid-size, 4px) + 2px);
          transition: opacity var(--bb-easing-duration-out) var(--bb-easing);
          width: 24px;
        }

        .sample-board:not([disabled]):hover {
          color: rgba(0, 0, 0, 1);
          transition-duration: var(--bb-easing-duration-in);
        }

        .sample-board:not([disabled]):hover::before {
          opacity: 1;
          transition-duration: var(--bb-easing-duration-in);
        }

        .sample-board.active {
          background-color: rgb(216, 196, 238);
          color: rgba(0, 0, 0, 1);
        }

        .sample-board.active::before {
          opacity: 1;
        }
      </style>

      <select id="sample-board-list">
        <option class="sample-board" value="" disabled selected>-- Choose a board --</option>
        ${boards
          .map(({ title, url }) => {
            return `<option class="sample-board" value="${url}">${title}</option>`;
          })
          .join("")}
      </select>
    `;

    root
      .querySelector("#sample-board-list")
      ?.addEventListener("change", (e: Event) => {
        const target = e.target as HTMLSelectElement;
        this.dispatchEvent(new StartEvent(target.value));
      });
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ) {
    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to locate shadow root in Start");
    }

    for (const opt of Array.from(root.querySelectorAll("option"))) {
      opt.removeAttribute("selected");
    }

    if (name !== "url" || newValue === null) {
      return;
    }

    const activeBoard = root.querySelector(`option[value="${newValue}"]`);
    if (!activeBoard) {
      return;
    }

    activeBoard.setAttribute("selected", "selected");
  }
}
