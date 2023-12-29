/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeDescriptor } from "@google-labs/breadboard";
import { ToastEvent, ToastType } from "./events.js";

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export type LoadArgs = {
  title?: string;
  description?: string;
  version?: string;
  diagram?: string;
  url?: string;
  nodes?: NodeDescriptor[];
};

const LOCAL_STORAGE_KEY = "bb-load-show-extended-info";

@customElement("bb-load")
export class Load extends LitElement {
  @property()
  title = "Untitled Board";

  @property()
  description = "No description provided";

  @property()
  version = "Unversioned";

  @property()
  url = "";

  @property({ reflect: true })
  expanded = localStorage.getItem(LOCAL_STORAGE_KEY) === "open";

  #copying = false;

  static styles = css`
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

    @media (min-width: 640px) {
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
      background: #fff;
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
      content: "Generating board image...";
    }
  `;

  #onToggleExpand() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const info = root.querySelector("#info");
    const toggle = root.querySelector("#toggle");
    if (!info || !toggle) {
      return;
    }

    info.classList.toggle("open");
    this.expanded = info.classList.contains("open");

    toggle.classList.toggle("collapse", this.expanded);

    if (this.expanded) {
      localStorage.setItem(LOCAL_STORAGE_KEY, "open");
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }

  async #onCopyToClipboard() {
    if (this.#copying) {
      return;
    }

    this.#copying = true;
    const linkUrl = new URL(window.location.href);
    linkUrl.searchParams.set("board", this.url);

    await navigator.clipboard.writeText(linkUrl.toString());
    this.dispatchEvent(
      new ToastEvent("Board URL copied to clipboard", ToastType.INFORMATION)
    );
    this.#copying = false;
  }

  render() {
    return html`
    <h1>${this.title} <button @click=${
      this.#onCopyToClipboard
    } id="copy-to-clipboard"></h1>
    <button @click=${this.#onToggleExpand} id="toggle" class="${
      this.expanded ? "collapse" : ""
    }">Toggle</button>
    <div id="info" class="${this.expanded ? "open" : ""}">
      <dl>
        <div>
          <dt>Version</dt>
          <dd>${this.version}</dd>

          <dt>Description</dt>
          <dd>${this.description}</dd>
        </div>
      </dl>
    </div>`;
  }
}
