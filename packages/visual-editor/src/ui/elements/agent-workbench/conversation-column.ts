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
import { CloseEvent } from "../../events/events.js";

import "../graph-editing-chat/chat-panel.js";
import "../shared/agent-avatar.js";

import * as Styles from "../../styles/styles.js";

export { ConversationColumn };

/**
 * Full-height conversation column for the Agent Workbench.
 *
 * Mounts `<bb-chat-panel mode="embedded">` as a permanently visible
 * conversation surface — no floating bubble, no toggle. The greeting
 * is shown automatically via the `resetGraphEditingAgent` trigger
 * (which fires on graph URL change and calls `showGreeting` when the
 * workbench is active).
 *
 * On first mount, if no entries exist yet, we show the greeting
 * immediately so the column is never empty.
 */
@customElement("bb-conversation-column")
class ConversationColumn extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = [
    Styles.HostColorsBase.baseColors,
    Styles.HostIcons.icons,
    css`
      :host {
        position: relative;
        width: 100%;
        height: 100%;
        background: var(--light-dark-n-100);
        overflow: hidden;
        box-sizing: border-box;
      }

      * {
        box-sizing: border-box;
      }

      #column-header {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 56px;
        z-index: 1;
        display: flex;
        align-items: center;
        padding: 0 var(--bb-grid-size-5);
        background: linear-gradient(
          to bottom,
          var(--light-dark-n-98) calc(100% - var(--bb-grid-size-3)),
          transparent
        );
        pointer-events: none;
      }

      #column-header > * {
        pointer-events: auto;
      }

      #back-button {
        display: flex;
        align-items: center;
        gap: var(--bb-grid-size);
        padding: 0;
        margin: 0;
        color: var(--light-dark-n-0);
        background: none;
        border: none;
        font: 500 var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        transition: translate 0.2s cubic-bezier(0, 0, 0.3, 1);

        & .g-icon {
          font-size: 20px;
        }

        &:not([disabled]) {
          cursor: pointer;

          &:hover {
            translate: -3px 0;
          }
        }
      }

      bb-chat-panel {
        --chat-messages-padding-top: 56px;
        width: 100%;
        height: 100%;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();

    // Ensure the conversation opens with a greeting when the workbench
    // first mounts. The trigger handles subsequent graph changes.
    const agent = this.sca.controller.editor.graphEditingAgent;
    agent.showGreeting();
  }

  render() {
    return html`
      <div id="column-header">
        <button
          id="back-button"
          @click=${() => {
            this.dispatchEvent(new CloseEvent());
          }}
        >
          <span class="g-icon">keyboard_arrow_left</span>
          <span>Go back</span>
        </button>
      </div>
      <bb-chat-panel
        mode="embedded"
        .showSelectionStrip=${false}
      ></bb-chat-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-conversation-column": ConversationColumn;
  }
}
