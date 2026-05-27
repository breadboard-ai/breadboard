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
import "../json-tree/json-tree.js";
import "./opie/opie-panel.js";

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
        min-height: 0;
        overflow: hidden;
        background: var(--light-dark-n-98);
        border-top: 1px solid var(--light-dark-n-90);
        color: var(--light-dark-n-10);
        font-family: var(--bb-font-family, sans-serif);
      }

      #devtools-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--bb-grid-size-3) var(--bb-grid-size-4);
        background: var(--light-dark-n-100);
        border-bottom: 1px solid var(--light-dark-n-90);

        & h2 {
          margin: 0;
          font: 600 var(--bb-label-large) / var(--bb-label-line-height-large)
            var(--bb-font-family);
          color: var(--light-dark-n-10);
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-2);
        }

        & .header-left {
          display: flex;
          align-items: center;
          gap: var(--bb-grid-size-4);
        }

        & #close-devtools {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--light-dark-n-40);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--bb-grid-size);
          border-radius: 50%;
          transition: background 0.2s;

          &:hover {
            background: var(--light-dark-n-90);
            color: var(--light-dark-n-10);
          }
        }
      }

      #devtools-tabs {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex: 0 0 auto;

        & button {
          display: flex;
          align-items: center;
          border-radius: var(--bb-grid-size-16);
          font-size: 12px;
          font-weight: 500;
          background: none;
          color: var(--light-dark-n-15);
          height: 32px;
          border: none;
          margin: 0 var(--bb-grid-size-2);
          padding: 0 var(--bb-grid-size-3);
          position: relative;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.2s cubic-bezier(0, 0, 0.3, 1),
            color 0.2s cubic-bezier(0, 0, 0.3, 1);

          &:hover,
          &[disabled] {
            color: var(--light-dark-p-20);
            background: var(--light-dark-n-95);
          }

          &[disabled] {
            cursor: auto;
          }
        }
      }

      #devtools-content {
        flex: 1;
        padding: var(--bb-grid-size-4);
        overflow: hidden;
        display: flex;
        flex-direction: row;
        gap: var(--bb-grid-size-3);
        min-height: 0;
      }
    `,
  ];

  render() {
    const devtools = this.sca.controller.editor.devtools;
    const opie = devtools.opie;
    const systemInstruction = opie.systemInstruction;
    const functions = opie.functionDeclarations;
    const entries = opie.entries;

    return html`
      <div id="devtools-header">
        <div class="header-left">
          <h2><span class="g-icon">developer_board</span> Opal Dev Tools</h2>
          <div id="devtools-tabs">
            <button
              class="sans-flex w-500 round"
              ?disabled=${devtools.activeTab === "opie"}
              @click=${() => {
                devtools.activeTab = "opie";
              }}
            >
              Opie
            </button>
          </div>
        </div>
        <button
          id="close-devtools"
          @click=${() => {
            devtools.isOpen = false;
          }}
        >
          <span class="g-icon">close</span>
        </button>
      </div>
      <div id="devtools-content">
        ${devtools.activeTab === "opie"
          ? html`
              <bb-devtools-opie-panel
                .entries=${entries}
                .systemInstruction=${systemInstruction}
                .functions=${functions}
              ></bb-devtools-opie-panel>
            `
          : ""}
      </div>
    `;
  }
}


