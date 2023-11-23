/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type ResultArgs = {
  title: string;
  result: string;
};

export class Result extends HTMLElement {
  constructor(result: ResultArgs) {
    super();
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          padding-top: calc(var(--bb-grid-size) * 3);
        }

        details {
          color: var(--bb-result-color, gray);
        }

        details pre {
          padding-left: 1rem;
          margin: 0;
        }
      </style>
      <details>
        <summary>${result.title}</summary>
        <pre><code>${result.result}</code></pre>
      </details>
    `;
  }
}
