/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { type UITheme, styles } from "../styles/default.js";
import {
  ElementType,
  Orientation,
  TodoItem,
  TodoList,
} from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import { SignalWatcher } from "@lit-labs/signals";

import "./button.js";
import "./card.js";
import "./hero-image.js";
import "./segment.js";

@customElement("ui-list")
export class UIList extends SignalWatcher(LitElement) {
  @property()
  accessor theme: UITheme | null = null;

  @property()
  accessor list: TodoList | null = null;

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
    if (!this.theme || !this.list) {
      return nothing;
    }

    const items = this.list.items;
    const theme = this.theme;

    return html`${this.list.presentation.behaviors.includes("editable")
        ? html`<div class=${classMap(theme.layouts.verticalPadded)}>
            <div class=${classMap(this.theme.layouts.horizontal)}>
              <ui-button
                class=${classMap(theme.elements.button)}
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
                case ElementType.CARD: {
                  return html`<ui-card
                    class=${classMap(theme.components.card)}
                    data-id=${id}
                    .segments=${item.presentation.segments}
                    .orientation=${item.presentation.orientation}
                    .disabled=${item.done}
                  >
                    ${repeat(item.presentation.segments, (segment, idx) => {
                      let classes = {};
                      if (segment.orientation === Orientation.VERTICAL) {
                        if (segment.type === ElementType.CARD) {
                          classes = { ...theme.layouts.vertical };
                        } else {
                          classes = { ...theme.layouts.verticalPadded };
                        }
                      } else {
                        if (segment.type === ElementType.CARD) {
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
                        class=${classMap(classes)}
                        slot=${`slot-${idx}`}
                        .theme=${theme}
                        .fields=${segment.fields}
                        .values=${values}
                        .disabled=${item.done}
                      ></ui-segment>`;
                    })}
                  </ui-card>`;
                }
              }

              return html`Unknown`;
            })}
      </section>`;
  }
}
