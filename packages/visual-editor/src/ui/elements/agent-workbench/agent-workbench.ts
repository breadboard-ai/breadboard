/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { SignalWatcher } from "@lit-labs/signals";
import { consume } from "@lit/context";
import { scaContext } from "../../../sca/context/context.js";
import { type SCA } from "../../../sca/sca.js";
import { ShowTooltipEvent, HideTooltipEvent } from "../../events/events.js";
import { styles } from "./agent-workbench.styles.js";

import "./run-log-column.js";
import "./objective-editor/objective-editor.js";
import "./tool-shelf/tool-shelf.js";
import "./conversation-column.js";

export { AgentWorkbench };

@customElement("bb-agent-workbench")
class AgentWorkbench extends SignalWatcher(LitElement) {
  @consume({ context: scaContext })
  accessor sca!: SCA;

  static styles = styles;

  #onClassicClick() {
    this.dispatchEvent(new HideTooltipEvent());
    this.sca.actions.workbench.setWorkbenchView("classic");
  }

  #onRunsToggle() {
    this.sca.actions.workbench.toggleRunsPanel();
  }

  render() {
    if (!this.sca.controller) return nothing;

    const runsOpen = this.sca.controller.editor.workbench.runsOpen;

    return html`
      <bb-workbench-splitter>
        <bb-conversation-column slot="s0"></bb-conversation-column>
        <div slot="s1" class="agent-config-column">
          <bb-objective-editor></bb-objective-editor>
          <bb-tool-shelf></bb-tool-shelf>
        </div>
      </bb-workbench-splitter>

      <div
        class=${classMap({
          "runs-panel-overlay": true,
          open: runsOpen,
        })}
      >
        <div class="runs-panel">
          ${runsOpen
            ? html`<bb-run-log-column
                @close=${() =>
                  this.sca.actions.workbench.toggleRunsPanel(false)}
              ></bb-run-log-column>`
            : nothing}
        </div>
      </div>

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
          id="runs-toggle"
          class=${classMap({ active: runsOpen })}
          @pointerover=${(evt: PointerEvent) => {
            this.dispatchEvent(
              new ShowTooltipEvent(
                runsOpen ? "Hide Runs" : "Show Runs",
                evt.clientX,
                evt.clientY
              )
            );
          }}
          @pointerout=${() => {
            this.dispatchEvent(new HideTooltipEvent());
          }}
          @click=${this.#onRunsToggle}
        >
          <span class="g-icon filled round">terminal</span>
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
