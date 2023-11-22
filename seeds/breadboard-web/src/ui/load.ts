/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { svgToPng } from "../utils/svg-to-png.js";

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

    if (!version) {
      version = "Unversioned";
    }

    this.#diagram = diagram;

    const show = localStorage.getItem(LOCAL_STORAGE_KEY) ? "open" : "";
    const root = this.attachShadow({ mode: "open" });
    const link = createLink(url);
    root.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
        }

        #info {
          display: none;
        }

        #info.open {
          display: block;
        }

        #toggle {
          cursor: pointer;
          position: absolute;
          width: 24px;
          height: 24px;
          right: 0;
          top: var(--bb-grid-size, 4px);
          background: var(--bb-icon-expand) center center no-repeat;
          border: none;
          font-size: 0;
        }

        #toggle.collapse {
          background: var(--bb-icon-collapse) center center no-repeat;
        }

        h1 {
          font: var(--bb-text-large) var(--bb-font-family);
          font-weight: 700;
        }

        h1 > a {
          text-decoration: none;
        }

        h1 > button {
          vertical-align: middle;
        }

        dl {
          display: grid;
          grid-template-columns: 35fr 60fr;
          column-gap: calc(var(--bb-grid-size) * 5);
          font-size: var(--bb-text-medium);
        }

        dt {
          font-weight: 700;
          margin-bottom: calc(var(--bb-grid-size) * 3);
        }

        dd {
          margin: 0;
          margin-bottom: calc(var(--bb-grid-size) * 5);
          line-height: 1.5;
        }

        #diagram dd {
          background: #FFF;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: calc(var(--bb-grid-size) * 8);
          border-radius: calc(var(--bb-grid-size) * 8);
        }

        #diagram-download {
          width: 24px;
          height: 24px;
          font-size: 0;
          display: inline-block;
          background: var(--bb-icon-download) center center no-repeat;
          vertical-align: middle;
        }

        #diagram-download:not([href]) {
          opacity: 0.4;
        }

        #mermaid {
          line-height: 1;
        }
      </style>
      <h1>${title} ${link}</h1>
      <button id="toggle">Toggle</button>
      <div id="info" class="${show}">
        <dl>
          <div>
            <dt>Version</dt>
            <dd>${version}</dd>

            <dt>Description</dt>
            <dd>${description}</dd>
          </div>
          
          <div id="diagram">
            <dt>Board diagram <a id="diagram-download" download="${title}" title="Download as PNG">Download as PNG</a></dt>
            <dd><div id="mermaid"></div></dd>
          </div>
        </dl>
      </div>
    `;

    const toggle = root.querySelector("#toggle");
    toggle?.addEventListener("click", () => {
      const info = root.querySelector("#info");
      info?.classList.toggle("open");
      toggle?.classList.toggle("collapse", info?.classList.contains("open"));

      if (info?.classList.contains("open")) {
        localStorage.setItem(LOCAL_STORAGE_KEY, "true");
      } else {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
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

    const root = this.shadowRoot;
    if (!root) {
      throw new Error("Unable to find shadow root");
    }

    const download = root.querySelector(
      "#diagram-download"
    ) as HTMLAnchorElement;

    const pngSrc = await svgToPng(svg);
    download.setAttribute("href", pngSrc);
  }
}
