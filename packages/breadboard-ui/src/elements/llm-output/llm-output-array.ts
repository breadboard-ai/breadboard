/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LLMContent } from "../../types/types.js";
import { map } from "lit/directives/map.js";
import { classMap } from "lit/directives/class-map.js";

@customElement("bb-llm-output-array")
export class LLMOutputArray extends LitElement {
  @property()
  values: LLMContent[] | null = null;

  @property({ reflect: true })
  selected = 0;

  static styles = css`
    :host {
      display: block;
    }

    #controls {
      display: flex;
      flex-direction: row;
      align-items: center;
      margin: var(--bb-grid-size-3) 0 var(--bb-grid-size) 0;
    }

    #controls h1 {
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      margin-right: var(--bb-grid-size);
    }

    #controls button {
      cursor: pointer;
      width: var(--bb-grid-size-7);
      height: var(--bb-grid-size-7);
      margin-right: var(--bb-grid-size);
      border-radius: 50%;
      border: 1px solid var(--bb-neutral-300);
      font-size: 0;
      background: var(--bb-neutral-0) var(--bb-icon-human) center center / 20px
        20px no-repeat;
    }

    #controls button.model {
      background: var(--bb-neutral-0) var(--bb-icon-model) center center / 20px
        20px no-repeat;
    }

    #controls button.user {
      background: var(--bb-neutral-0) var(--bb-icon-human) center center / 20px
        20px no-repeat;
    }

    #controls button[disabled] {
      cursor: auto;
      background-color: var(--bb-output-100);
    }

    bb-llm-output {
      display: none;
    }

    bb-llm-output.visible {
      display: block;
    }
  `;

  protected willUpdate(
    changedProperties:
      | PropertyValueMap<{ values: LLMContent[] | null }>
      | Map<PropertyKey, unknown>
  ): void {
    if (!changedProperties.has("values")) {
      return;
    }

    if (!this.values) {
      return;
    }

    this.selected = this.values.length - 1;
  }

  render() {
    return this.values
      ? html` <div id="controls">
            <h1>Role</h1>
            ${map(this.values, (item, idx) => {
              const roleClass = (item.role || "user")
                .toLocaleLowerCase()
                .replaceAll(/\s/gim, "-");
              return html`<button
                class=${classMap({ [roleClass]: true })}
                ?disabled=${idx === this.selected}
                title=${item.role || "User"}
                @click=${() => {
                  this.selected = idx;
                }}
              >
                ${item.role || "User"}
              </button>`;
            })}
          </div>

          <div>
            ${map(this.values, (item, idx) => {
              return html`<bb-llm-output
                class=${classMap({ visible: idx === this.selected })}
                .value=${item}
              ></bb-llm-output>`;
            })}
          </div>`
      : html`No items set`;
  }
}
