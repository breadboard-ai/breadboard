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
  Field,
  Orientation,
  Segment,
  TodoItem,
  TodoList,
} from "../../types/types.js";
import { classMap } from "lit/directives/class-map.js";
import { merge } from "../styles/utils.js";
import { repeat } from "lit/directives/repeat.js";
import { SignalWatcher } from "@lit-labs/signals";

import "./card.js";
import "./hero-image.js";

@customElement("ui-list")
export class List extends SignalWatcher(LitElement) {
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

  #renderBehavior(theme: UITheme, fieldName: string, field: Field) {
    return html`<button
      class=${classMap(theme.elements.button)}
      data-behavior=${fieldName}
    >
      ${field.title ?? "Action"}
    </button>`;
  }

  #renderField(
    theme: UITheme,
    item: TodoItem,
    fieldName: string,
    field: Field
  ) {
    const value = item[fieldName as keyof TodoItem];

    switch (field.as) {
      case "image": {
        if (!field.src) {
          return html`Unable to render image - no source provided.`;
        }

        return html`<ui-hero-image
          class=${classMap(theme.components.heroImage)}
        >
          <img
            src=${field.src}
            slot="hero"
            class=${classMap(theme.modifiers.cover)}
            alt=${field.title}
          />
          ${field.title
            ? html`<h1
                slot="headline"
                class=${classMap(
                  merge(theme.elements.h1, theme.modifiers.headline)
                )}
              >
                ${field.title}
              </h1>`
            : nothing}
        </ui-hero-image>`;
      }

      case "date":
      case "text": {
        if (field.behaviors?.includes("editable")) {
          return html`<input
            .id=${fieldName}
            .name=${fieldName}
            .value=${value}
            .placeholder=${field.title ?? "Enter a value"}
            ?disabled=${item.done}
            type=${field.as}
            class=${classMap(
              merge(
                theme.elements.input,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          />`;
        }
        return html`<p
          class=${classMap(
            merge(
              theme.elements.input,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
          ${value}
        </p>`;
      }

      case "longstring": {
        if (field.behaviors?.includes("editable")) {
          return html`<textarea
            .id=${fieldName}
            .name=${fieldName}
            .value=${value ?? ""}
            .placeholder=${field.title ?? "Enter a value"}
            ?disabled=${item.done}
            class=${classMap(
              merge(
                theme.elements.textarea,
                field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
              )
            )}
          ></textarea>`;
        }
        return html`<p
          class=${classMap(
            merge(
              theme.elements.textarea,
              field.modifiers?.includes("hero") ? theme.modifiers.hero : {}
            )
          )}
        >
          ${value}
        </p>`;
      }

      default:
        if (field.as === "behavior") {
          return this.#renderBehavior(theme, fieldName, field);
        }

        return html`Unknown field`;
    }
  }

  #renderSegment(item: TodoItem, segment: Segment, idx: number) {
    if (!this.theme || !this.list) {
      return nothing;
    }

    const theme = this.theme;
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

    return html`<div class=${classMap(classes)} slot=${`slot-${idx}`}>
      ${repeat(Object.entries(segment.fields), ([field, presentation]) => {
        return this.#renderField(theme, item, field, presentation);
      })}
    </div>`;
  }

  render() {
    if (!this.theme || !this.list) {
      return nothing;
    }

    const items = this.list.items;
    const theme = this.theme;

    return html`${this.list.presentation.behaviors.includes("editable")
        ? html`<div class=${classMap(theme.layouts.verticalPadded)}>
            <div class=${classMap(this.theme.layouts.horizontal)}>
              <button
                class=${classMap(theme.elements.button)}
                data-behavior="add"
              >
                Add
              </button>
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
                      return this.#renderSegment(item, segment, idx);
                    })}
                  </ui-card>`;
                }
              }

              return html`Unknown`;
            })}
      </section>`;
  }
}
