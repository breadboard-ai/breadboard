/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type LoadArgs = {
  title: string;
  description?: string;
  version?: string;
};

export class Load extends HTMLElement {
  constructor({ title, description = "", version = "" }: LoadArgs) {
    super();
    if (version) version = `version: ${version}`;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        h2 {
          font-weight: var(--bb-title-font-weight, normal);
        }
      </style>
      <h2>${title}</h2>
      <p>${description}</p>
      <p>${version}</p>
    `;
  }
}
