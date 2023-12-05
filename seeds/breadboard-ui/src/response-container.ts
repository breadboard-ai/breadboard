/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class ResponseContainer extends HTMLElement {
  constructor() {
    super();

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
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
