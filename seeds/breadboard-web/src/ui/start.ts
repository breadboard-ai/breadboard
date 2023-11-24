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

        h1 {
          font-size: var(--bb-text-small);
          font-weight: 500;
          margin: 0 0 calc(var(--bb-grid-size) * 2) 0;
        }
        
        #create-board-from-url {
          margin: 0 0 calc(var(--bb-grid-size) * 4) 0;
        }

        #sample-board-list {
          flex: 1;
          overflow-y: scroll;
          overflow-y: overlay;
          scrollbar-gutter: stable;
          padding-right: (var(--bb-grid-size) * 2);
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

      <h1>Sample boards</h1>
      <div id="sample-board-list">
        ${boards
          .map(({ title, url }) => {
            return `<button class="sample-board" data-value="${url}">${title}</option>`;
          })
          .join("")}
      </div>
    `;

    root.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement;
      if (!(target.dataset && target.dataset.value)) {
        return;
      }

      this.dispatchEvent(new StartEvent(target.dataset.value));
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

    for (const btn of Array.from(root.querySelectorAll(".sample-board"))) {
      btn.classList.remove("active");
    }

    if (name !== "url" || newValue === null) {
      return;
    }

    const activeBoard = root.querySelector(`[data-value="${newValue}"]`);
    if (!activeBoard) {
      return;
    }

    activeBoard.classList.add("active");
  }
}
