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
import { UITheme } from "../theme/theme.js";
import { merge } from "../styles/utils.js";

import "./button.js";
import "./card.js";
import "./hero-image.js";
import "./segment.js";
import { Orientation } from "../../types/particles.js";

@customElement("ui-list")
export class UIList extends SignalWatcher(LitElement) {
  @property()
  accessor list: TodoList | null = null;

  @property({ reflect: true, type: String })
  accessor orientation: Orientation = "vertical";

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
      }

      #items {
        overflow: auto;
        scrollbar-width: none;
      }

      :host([orientation="vertical"]) {
        #items {
          display: flex;
          flex-direction: column;
          & > * {
            margin-bottom: var(--g-5);

            &:last-of-type {
              margin-bottom: 0;
            }
          }
        }
      }

      :host([orientation="horizontal"]) {
        #items {
          display: flex;
          flex-direction: row;

          & > * {
            max-width: 100%;
            flex: 0 0 auto;
            margin-right: var(--g-5);

            &:last-of-type {
              margin-right: 0;
            }
          }

          &:has(> :nth-child(2)) {
            mask-image: linear-gradient(
              to right,
              rgba(255, 0, 255, 0) 0%,
              rgba(255, 0, 255, 0.9) 12px,
              rgba(255, 0, 255, 1) 16px,
              rgba(255, 0, 255, 1) calc(100% - 16px),
              rgba(255, 0, 255, 0) 100%
            );

            margin-left: -16px;
            margin-right: -16px;

            padding-left: 16px;
            padding-right: 16px;

            & > * {
              max-width: 80%;
            }
          }
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

    return html`<section
      id="list"
      class=${classMap(this.theme.components.list)}
    >
      ${this.list.presentation.behaviors.includes("editable")
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
      <section id="items" class=${classMap(this.theme.components.listItems)}>
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
                          classes = { ...theme.components.segmentVertical };
                        } else {
                          classes = {
                            ...theme.components.segmentVerticalPadded,
                          };
                        }
                      } else {
                        if (segment.type === "media") {
                          classes = { ...theme.components.segmentHorizontal };
                        } else {
                          classes = {
                            ...theme.components.segmentHorizontalPadded,
                          };
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
      </section>
    </section>`;
  }
}
