/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { EditHistoryEntry } from "@google-labs/breadboard";
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { map } from "lit/directives/map.js";
import { RedoEvent, UndoEvent } from "../../events/events.js";

@customElement("bb-graph-history")
export class GraphHistory extends LitElement {
  @property()
  accessor entries: EditHistoryEntry[] | null = null;

  @property()
  accessor count: number = -1;

  @property()
  accessor canRedo = false;

  @property()
  accessor canUndo = false;

  @property()
  accessor idx = -1;

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: 36px auto;
      position: fixed;
      top: 120px;
      left: 10px;
      border-radius: var(--bb-grid-size-2);
      color: var(--bb-neutral-0);
      padding: var(--bb-grid-size-3);
      height: 100%;
      max-height: 30vh;
      overflow: auto;
      width: 100%;
      max-width: 35vh;
      z-index: 1000;
    }

    #underlay {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--bb-ui-900);
      opacity: 0.92;
    }

    h1 {
      display: flex;
      align-items: center;
      font: 400 var(--bb-title-medium) / var(--bb-title-line-height-medium)
        var(--bb-font-family);
      margin: 0;
      padding: 0 0 var(--bb-grid-size-3) 0;
      z-index: 1;
      position: relative;
    }

    h1 span {
      flex: 1;
    }

    #undo,
    #redo {
      width: 20px;
      height: 20px;
      margin-left: var(--bb-grid-size-2);
      border: none;
      font-size: 0;
      cursor: pointer;
    }

    #undo {
      background: transparent var(--bb-icon-undo-inverted) center center / 20px
        20px no-repeat;
    }

    #redo {
      background: transparent var(--bb-icon-redo-inverted) center center / 20px
        20px no-repeat;
    }

    #undo[disabled],
    #redo[disabled] {
      opacity: 0.4;
      cursor: auto;
    }

    ol {
      position: relative;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      margin: 0;
      padding: 0 var(--bb-grid-size-3) 0 var(--bb-grid-size-7);
      overflow-y: scroll;
      scrollbar-gutter: stable;
    }

    li {
      margin-bottom: var(--bb-grid-size);
    }

    li.current {
      color: var(--bb-nodes-300);
    }
  `;

  render() {
    if (!this.entries) {
      return nothing;
    }

    return html`<div id="underlay"></div>
      <h1>
        <span>Change History</span>
        <button
          id="undo"
          ?disabled=${!this.canUndo}
          @click=${() => {
            if (!this.canUndo) {
              return;
            }

            this.dispatchEvent(new UndoEvent());
          }}
        >
          Undo</button
        ><button
          id="redo"
          ?disabled=${!this.canRedo}
          @click=${() => {
            if (!this.canRedo) {
              return;
            }

            this.dispatchEvent(new RedoEvent());
          }}
        >
          Redo
        </button>
      </h1>
      <ol>
        ${map(this.entries, (entry, idx) => {
          return html`<li class=${classMap({ current: idx === this.idx })}>
            ${entry.label}
          </li>`;
        })}
      </ol>`;
  }
}
