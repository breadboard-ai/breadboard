/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class Done extends HTMLElement {
  constructor(message = "Done.") {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }

        div {
          position: relative;
          padding-left: calc(var(--bb-grid-size) * 8);
        }

        div::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          width: calc(var(--bb-grid-size) * 5);
          height: calc(var(--bb-grid-size) * 5);
          background: var(--bb-done-color);
          border-radius: 50%;
        }
      </style>
      <div>${message}</div>
    `;
  }
}
