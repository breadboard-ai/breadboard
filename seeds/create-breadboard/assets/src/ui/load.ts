/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { svgToPng } from "../utils/svg-to-png.js";
import { ToastEvent, ToastType } from "./events.js";

export type LoadArgs = {
  title: string;
  description?: string;
  version?: string;
  diagram?: string;
  url?: string;
};

const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@10.6.1/+esm";
const LOCAL_STORAGE_KEY = "bb-ui-show-diagram";

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
          font: var(--bb-text-baseline) var(--bb-font-family);
          font-weight: 700;
        }

        h1 > a {
          text-decoration: none;
        }

        h1 > button {
          vertical-align: middle;
        }

        dt {
          font-size: var(--bb-text-medium);
          font-weight: 700;
          margin-bottom: calc(var(--bb-grid-size) * 3);
        }

        dd {
          font-size: var(--bb-text-medium);
          margin: 0;
          margin-bottom: calc(var(--bb-grid-size) * 5);
          line-height: 1.5;
        }

        @media(min-width: 640px) {
          h1 {
            font: var(--bb-text-large) var(--bb-font-family);
            font-weight: 700;
          }

          dl {
            display: grid;
            grid-template-columns: 35fr 60fr;
            column-gap: calc(var(--bb-grid-size) * 5);
            font-size: var(--bb-text-medium);
          }

          dt {
            font-size: var(--bb-text-baseline);
          }
  
          dd {
            font-size: var(--bb-text-baseline);
          }
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

        #copy-to-clipboard {
          width: 24px;
          height: 24px;
          font-size: 0;
          display: inline-block;
          background: var(--bb-icon-copy-to-clipboard) center center no-repeat;
          vertical-align: middle;
          border: none;
          cursor: pointer;
          transition: opacity var(--bb-easing-duration-out) var(--bb-easing);
          opacity: 0.5;
        }

        #copy-to-clipboard:hover {
          transition: opacity var(--bb-easing-duration-in) var(--bb-easing);
          opacity: 1;
        }

        #mermaid {
          line-height: 1;
        }
      </style>
      <h1>${title} <button id="copy-to-clipboard"></h1>
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

    let copying = false;
    const copyToClipboard = root.querySelector("#copy-to-clipboard");
    copyToClipboard?.addEventListener("click", async () => {
      if (copying) {
        return;
      }

      copying = true;
      const linkUrl = new URL(window.location.href);
      linkUrl.searchParams.set("board", url);

      await navigator.clipboard.writeText(linkUrl.toString());
      this.dispatchEvent(
        new ToastEvent("Board URL copied to clipboard", ToastType.INFORMATION)
      );
      copying = false;
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
