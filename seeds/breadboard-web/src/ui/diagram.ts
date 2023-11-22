/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiagramArgs = {
  diagram?: string;
};

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.6.1/+esm";

const LOCAL_STORAGE_KEY = "bb-ui-show-diagram";

export class Diagram extends HTMLElement {
  #diagram: string;

  constructor({ diagram }: DiagramArgs) {
    super();
    this.#diagram = diagram || "";
    const show = localStorage.getItem(LOCAL_STORAGE_KEY) ? "open" : "";
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }
        details {
          color: var(--bb-result-color, gray);
          padding-bottom: 1rem;
        }

      </style>
      <details ${show}>
      <summary>Board diagram</summary>
      <div id="mermaid"></div>
      </details>`;
    root.querySelector("details")?.addEventListener("toggle", (e) => {
      if ((e.target as HTMLDetailsElement).open) {
        localStorage.setItem(LOCAL_STORAGE_KEY, "true");
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    });
  }

  async connectedCallback() {
    const module = await import(/* @vite-ignore */ MERMAID_URL);
    const mermaid = module.default;
    mermaid.initialize({ startOnLoad: false });
    const { svg } = await mermaid.render("graphDiv", this.#diagram);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.shadowRoot!.querySelector("#mermaid")!.innerHTML = svg;
  }
}
