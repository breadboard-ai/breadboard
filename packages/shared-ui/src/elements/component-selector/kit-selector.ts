/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import * as StringsHelper from "../../strings/helper.js";
const Strings = StringsHelper.forSection("KitSelector");

import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";
import { KitToggleEvent } from "../../events/events.js";

@customElement("bb-kit-selector")
export class KitSelector extends LitElement {
  @property()
  kits: string[] = [];

  @property()
  activeKits: string[] = [];

  static styles = css`
    :host {
      display: block;
      padding: var(--bb-grid-size-2);
      background: var(--bb-neutral-0);
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-500);
      box-shadow: var(--bb-elevation-5);
    }

    header {
      color: var(--bb-neutral-900);
      font: 400 var(--bb-label-medium) / var(--bb-label-line-height-medium)
        var(--bb-font-family);
      margin-bottom: var(--bb-grid-size-2);
    }

    section {
      & ul {
        display: flex;
        flex-direction: column;
        list-style: none;
        padding: 0;
        margin: 0;

        & li {
          margin-bottom: var(--bb-grid-size);

          & button {
            opacity: 0.5;
            cursor: pointer;
            background: transparent var(--bb-icon-check) 0 center / 20px 20px
              no-repeat;
            font: 400 var(--bb-label-small) / var(--bb-label-line-height-small)
              var(--bb-font-family);
            padding: 0 0 0 var(--bb-grid-size-7);
            border: none;
          }

          &.active button {
            opacity: 1;
          }
        }
      }
    }
  `;

  render() {
    if (!this.kits) {
      return nothing;
    }

    return html` <header>${Strings.from("TITLE")}</header>
      <section>
        <ul>
          ${map(this.kits, (kit) => {
            return html`<li
              class=${classMap({
                active: this.activeKits.includes(kit),
              })}
            >
              <button
                @click=${() => {
                  this.dispatchEvent(new KitToggleEvent(kit));
                }}
              >
                ${kit}
              </button>
            </li>`;
          })}
        </ul>
      </section>`;
  }
}
