/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { icons } from "../../styles/icons.js";

@customElement("bb-devtools")
export class DevTools extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    icons,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background: var(--light-dark-n-100);
        border-top: 1px solid var(--light-dark-n-90);
      }

      #devtools-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--bb-grid-size-2) var(--bb-grid-size-4);
        background: var(--light-dark-n-98);
        border-bottom: 1px solid var(--light-dark-n-90);

        & h2 {
          margin: 0;
          font: 500 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--light-dark-n-10);
        }

        & #close-devtools {
          background: none;
          border: none;
          cursor: pointer;
          padding: var(--bb-grid-size);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--light-dark-n-40);
          transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1),
                      color 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &:focus {
            background: var(--light-dark-n-90);
            color: var(--light-dark-n-10);
          }
        }
      }

      #devtools-content {
        flex: 1;
        padding: var(--bb-grid-size-4);
        overflow: auto;
        background: var(--light-dark-n-100);
      }
    `,
  ];

  render() {
    return html`
      <div id="devtools-header">
        <h2>Dev Tools</h2>
        <button
          id="close-devtools"
          @click=${() => {
            this.sca.controller.editor.devtools.isOpen = false;
          }}
        >
          <span class="g-icon">close</span>
        </button>
      </div>
      <div id="devtools-content">
        <!-- Blank for now -->
      </div>
    `;
  }
}
