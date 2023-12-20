/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriptor } from "@google-labs/breadboard";
import { ToastEvent, ToastType } from "./events.js";

export type LoadArgs = {
  title: string;
  description?: string;
  version?: string;
  diagram?: string;
  url?: string;
  nodes?: NodeDescriptor[];
};

const LOCAL_STORAGE_KEY = "bb-ui-show-diagram";

export class Load extends HTMLElement {
  constructor({ title, description = "", version = "", url = "" }: LoadArgs) {
    super();

    if (!version) {
      version = "Unversioned";
    }

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
          margin: calc(var(--bb-grid-size, 4px) * 4) 0;
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
          width: 100%;
          max-width: 50vw;
        }

        #mermaid:empty::before {
          content: 'Generating board image...';
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
}
