/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, PropertyValueMap, nothing } from "lit";
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

  @property({ reflect: true })
  mode: "visual" | "json" = "visual";

  static styles = css`
    * {
      box-sizing: border-box;
    }

    :host {
      display: block;
    }

    #controls {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      margin: var(--bb-grid-size-4) 0 var(--bb-grid-size-2) 0;
      min-height: var(--bb-grid-size-7);
    }

    #controls h1 {
      font: 400 var(--bb-label-large) / var(--bb-label-line-height-large)
        var(--bb-font-family);
      margin-right: var(--bb-grid-size);
    }

    #controls #role-buttons {
      flex: 1;
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

    #controls select {
      display: block;
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      padding: var(--bb-grid-size) var(--bb-grid-size-2);
      border: 1px solid var(--bb-neutral-300);
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
            ${this.mode === "visual"
              ? html`<h1>Role</h1>
                  <div id="role-buttons">
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
                  </div>`
              : nothing}
            <select
              @input=${(evt: Event) => {
                if (!(evt.target instanceof HTMLSelectElement)) {
                  return;
                }

                const mode = evt.target.value;
                if (mode !== "visual" && mode !== "json") {
                  return;
                }

                this.mode = mode;
              }}
            >
              <option value="visual" ?selected=${this.mode === "visual"}>
                Visual Debug
              </option>
              <option value="json" ?selected=${this.mode === "json"}>
                Raw data
              </option>
            </select>
          </div>

          <div>
            ${this.mode === "visual"
              ? map(this.values, (item, idx) => {
                  return html`<bb-llm-output
                    class=${classMap({ visible: idx === this.selected })}
                    .value=${item}
                  ></bb-llm-output>`;
                })
              : html`<bb-json-tree .json=${this.values}></bb-json-tree>`}
          </div>`
      : html`No items set`;
  }
}
