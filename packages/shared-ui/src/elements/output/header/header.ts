/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../../styles/icons";
import { styleMap } from "lit/directives/style-map.js";
import { StopEvent } from "../../../events/events";

@customElement("bb-header")
export class Header extends LitElement {
  @property()
  accessor progress = 0; /** 0 -> 1 */

  @property()
  accessor menuActive = false;

  @property()
  accessor replayActive = false;

  static styles = [
    icons,
    css`
      :host {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 76px;
        border-bottom: 1px solid var(--s-70, var(--bb-neutral-100));
        padding: 0 var(--bb-grid-size-4);
        position: relative;
        flex: 0 0 auto;
      }

      #menu,
      #replay {
        width: 20px;
        height: 20px;
        background: transparent;
        border: none;
        font-size: 20px;
        opacity: 0.6;
        transition: opacity 0.3s cubic-bezier(0, 0, 0.3, 1);
        padding: 0;
        color: var(--p-15, var(--bb-neutral-800));
        border-radius: 50%;

        &:not([disabled]) {
          cursor: pointer;

          &:focus,
          &:hover {
            opacity: 1;
          }
        }
      }

      #progress-container {
        flex: 1 1 auto;
        margin: 0 var(--bb-grid-size-2);
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        > #progress {
          width: 100%;
          max-width: 320px;
          height: 4px;
          background: var(--p-70, var(--bb-neutral-200));
          border-radius: var(--bb-grid-size-16);
          position: relative;

          &::before {
            content: "";
            position: absolute;
            top: 0px;
            left: 0px;
            width: calc(var(--progress) * 100%);
            max-width: 100%;
            height: 4px;
            background: var(--p-40, var(--bb-neutral-600));
            border-radius: var(--bb-grid-size-16);
            transition: width 0.3s cubic-bezier(0, 0, 0.3, 1);
          }
        }
      }
    `,
  ];

  render() {
    return html` <button
        id="menu"
        ?disabled=${!this.menuActive}
        @click=${() => {
          // TODO
        }}
      >
        <span class="g-icon">menu</span>
      </button>

      <div id="progress-container">
        <div
          id="progress"
          style=${styleMap({ "--progress": this.progress })}
        ></div>
      </div>

      <button
        id="replay"
        ?disabled=${!this.replayActive}
        @click=${() => {
          this.dispatchEvent(new StopEvent(true));
        }}
      >
        <span class="g-icon">replay</span>
      </button>`;
  }
}
