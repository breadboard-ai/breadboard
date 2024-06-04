/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { DownloadRunEvent } from "../events/events.js";

@customElement("app-nav")
export class AppNav extends LitElement {
  @property({ reflect: true })
  visible = false;

  static override styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: min(80vw, 340px);
      height: 100%;
      overflow: hidden;
      z-index: 1000;
      pointer-events: none;
      color: var(--bb-neutral-700);
      user-select: none;
    }

    #menu {
      transition: transform 0.3s cubic-bezier(0, 0, 0.3, 1);
      transform: translateX(-100%);
      will-change: transform;
      width: calc(100% - 10px);
      background: var(--bb-neutral-800);
      border-right: 1px solid var(--bb-neutral-600);
      pointer-events: auto;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: auto;
      color: var(--bb-neutral-0);
    }

    :host([visible="true"]) {
      pointer-events: auto;
    }

    :host([visible="true"]) #menu {
      transition: transform 0.15s cubic-bezier(0, 0, 0.3, 1);
      transform: none;
    }

    section {
      padding: var(--bb-grid-size-4);
      border-bottom: 1px solid var(--bb-neutral-600);
    }

    section h1 {
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      margin: 0;
      padding: 0;
    }

    section:last-of-type {
      border-bottom: none;
    }

    button {
      background: var(--bb-neutral-900);
      border: none;
      border-radius: var(--bb-grid-size-10);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-3);
      font: normal var(--bb-label-small) / var(--bb-label-line-height-small)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
    }
  `;

  override render() {
    return html`<div
      id="menu"
      @pointerdown=${(evt: Event) => {
        evt.stopImmediatePropagation();
      }}
    >
      <section>
        <h1>Menu</h1>
        <div>
          <button
            id="clear-secrets"
            @click=${() => {
              if (!confirm("Are you sure?")) {
                return;
              }

              globalThis.localStorage.clear();
            }}
          >
            Clear secrets
          </button>
        </div>
        <div>
          <button
            id="download-run"
            @click=${() => {
              this.dispatchEvent(new DownloadRunEvent());
            }}
          >
            Download run
          </button>
        </div>
      </section>
    </div>`;
  }
}
