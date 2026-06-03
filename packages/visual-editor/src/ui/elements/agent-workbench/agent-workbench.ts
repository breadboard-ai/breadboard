/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { ShowTooltipEvent, HideTooltipEvent } from "../../events/events.js";
import { styles } from "./agent-workbench.styles.js";

import "./run-log-column.js";

@customElement("bb-agent-workbench")
export class AgentWorkbench extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = styles;

  #onClassicClick() {
    this.dispatchEvent(new HideTooltipEvent());
    this.sca.actions.workbench.setWorkbenchView("classic");
  }

  render() {
    if (!this.sca.controller) return nothing;

    return html`
      <ui-tri-splitter>
        <div slot="s0" class="column-placeholder">
          <span class="g-icon">chat</span>
          <h2>Opie Conversation</h2>
          <p>This column will contain the contextual conversation history.</p>
        </div>
        <div slot="s1" class="column-placeholder">
          <span class="g-icon">settings</span>
          <h2>Agent Configuration</h2>
          <p>
            This column will contain the objective editor, tools, and skills.
          </p>
        </div>
        <bb-run-log-column slot="s2"></bb-run-log-column>
      </ui-tri-splitter>

      <div id="workbench-controls">
        <button
          id="undo"
          disabled
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Undo (Unavailable)",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
        >
          <span class="g-icon filled round">undo</span>
        </button>
        <button
          id="redo"
          disabled
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Redo (Unavailable)",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
        >
          <span class="g-icon filled round">redo</span>
        </button>
        <button
          id="graph-view"
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                "Classic Graph View",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${this.#onClassicClick}
        >
          <span class="g-icon filled round">network_node</span>
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-agent-workbench": AgentWorkbench;
  }
}
