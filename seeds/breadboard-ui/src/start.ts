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
