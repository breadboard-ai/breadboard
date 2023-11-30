/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class Progress extends HTMLElement {
  constructor(message: string) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          padding-top: calc(var(--bb-grid-size) * 3);
        }

        div {
          margin-bottom: calc(var(--bb-grid-size) * 6);
        }
      </style>
      <div>${message}</div>
    `;
  }
}
