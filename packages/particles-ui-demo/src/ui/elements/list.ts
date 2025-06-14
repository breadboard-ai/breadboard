/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TodoItem, TodoList } from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { SignalWatcher } from "@lit-labs/signals";
import { styles } from "../styles/index.js";
import { consume } from "@lit/context";
import { themeContext } from "../context/theme.js";
import { UITheme } from "../theme/default.js";
import { merge } from "../styles/utils.js";

import "./button.js";
import "./card.js";
import "./hero-image.js";
import "./segment.js";

@customElement("ui-list")
export class UIList extends SignalWatcher(LitElement) {
  @property()
  accessor list: TodoList | null = null;

  @consume({ context: themeContext })
  accessor theme: UITheme | undefined;

  static styles = [
    styles,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        background: var(--n-95);
        padding: var(--g-4);
        border-radius: calc(var(--g-4) + var(--g-4));
        margin-bottom: var(--g-16);
      }

      #items > * {
        margin-bottom: var(--g-5);

        &:last-of-type {
          margin-bottom: 0;
        }
      }
    `,
  ];

  render() {
    if (!this.list || !this.theme) {
      return nothing;
    }

    const items = this.list.items;
    const theme = this.theme;

    return html`${this.list.presentation.behaviors.includes("editable")
        ? html`<div class=${classMap(this.theme.layouts.verticalPadded)}>
            <div class=${classMap(this.theme.layouts.horizontal)}>
              <ui-button
                class=${classMap(this.theme.elements.button)}
                data-behavior="add"
                .icon=${"add"}
              >
                Add
              </ui-button>
            </div>
          </div>`
        : nothing}
      <section id="items">
        ${items.size === 0
          ? html`<div>No items</div>`
          : repeat(items, ([id, item]) => {
              switch (item.presentation.type) {
                case "card": {
                  return html`<ui-card
                    class=${classMap(theme.components.card)}
                    data-id=${id}
                    .segments=${item.presentation.segments}
                    .orientation=${item.presentation.orientation}
                    .disabled=${item.done}
                  >
                    ${repeat(item.presentation.segments, (segment, idx) => {
                      let classes = {};
                      if (segment.orientation === "vertical") {
                        if (segment.type === "media") {
                          classes = { ...theme.layouts.vertical };
                        } else {
                          classes = { ...theme.layouts.verticalPadded };
                        }
                      } else {
                        if (segment.type === "media") {
                          classes = { ...theme.layouts.horizontal };
                        } else {
                          classes = { ...theme.layouts.horizontalPadded };
                        }
                      }

                      const values: Record<string, unknown> = {};
                      for (const fieldName of Object.keys(segment.fields)) {
                        const key = fieldName as keyof TodoItem;
                        const value = item[key];
                        if (typeof value === "undefined") {
                          continue;
                        }

                        values[key] = value;
                      }

                      return html`<ui-segment
                        class=${classMap(
                          merge(classes, { "layout-al-fs": true })
                        )}
                        slot=${`slot-${idx}`}
                        .containerOrientation=${item.presentation.orientation}
                        .theme=${theme}
                        .fields=${segment.fields}
                        .values=${values}
                        .disabled=${item.done}
                      ></ui-segment>`;
                    })}
                  </ui-card>`;
                }
              }

              return html`Unexpected input information`;
            })}
      </section>`;
  }
}
