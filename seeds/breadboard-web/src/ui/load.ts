/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type LoadArgs = {
  title: string;
  description?: string;
  version?: string;
  diagram?: string;
  url?: string;
};

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.6.1/+esm";

const LOCAL_STORAGE_KEY = "bb-ui-show-diagram";

const createLink = (url?: string) => {
  if (!url) return "";
  const linkUrl = new URL(window.location.href);
  if (linkUrl.searchParams.has("board")) return "";
  linkUrl.searchParams.set("board", url);
  return `<a href="${linkUrl}">🔗</a>`;
};

export class Load extends HTMLElement {
  #diagram: string;

  constructor({
    title,
    description = "",
    version = "",
    url = "",
    diagram = "",
  }: LoadArgs) {
    super();

    if (version) {
      version = `Version: ${version}`;
    }

    this.#diagram = diagram;

    const show = localStorage.getItem(LOCAL_STORAGE_KEY) ? "open" : "";
    const root = this.attachShadow({ mode: "open" });
    const link = createLink(url);
    root.innerHTML = `
      <style>
        :host {
          display: block;
        }

        h1 {
          font: var(--bb-text-large) var(--bb-font-family);
          font-weight: 700;
          display: inline-block;
        }

        h1 > a {
          text-decoration: none;
        }

        h1 > button {
          vertical-align: middle;
        }
      </style>
      <details ${show}>
        <summary>
          <h1>${title} ${link}</h1>
        </summary>
        <p>${description}</p>
        <p>${version}</p>
        <div id="mermaid"></div>
      </details>
    `;

    root.querySelector("details")?.addEventListener("toggle", (e) => {
      if ((e.target as HTMLDetailsElement).open) {
        localStorage.setItem(LOCAL_STORAGE_KEY, "true");
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    });

    root.addEventListener("click", (evt: Event) => {
      const target = evt.target as HTMLElement;
      target;
    });
  }

  async connectedCallback() {
    if (!this.#diagram) {
      return;
    }

    const module = await import(/* @vite-ignore */ MERMAID_URL);
    const mermaid = module.default;
    mermaid.initialize({ startOnLoad: false });
    const { svg } = await mermaid.render("graphDiv", this.#diagram);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.shadowRoot!.querySelector("#mermaid")!.innerHTML = svg;
  }
}
