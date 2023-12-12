/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class InputContainer extends HTMLElement {
  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          padding: calc(var(--bb-grid-size) * 2);
        }
      </style>
      <slot></slot>
    `;
  }

  clearContents() {
    const children = Array.from(this.querySelectorAll("*"));
    for (const child of children) {
      child.remove();
    }
  }
}
