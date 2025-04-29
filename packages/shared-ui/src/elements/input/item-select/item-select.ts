/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { icons as MaterialIcons } from "../../../styles/icons";
import { EnumValue } from "../../../types/types";

@customElement("bb-item-select")
export class ItemSelect extends LitElement {
  @property({ reflect: true, type: Boolean })
  accessor transparent = false;

  @property()
  accessor heading: string | null = null;

  @property({ reflect: true, type: String })
  accessor alignment: "top" | "bottom" = "bottom";

  @property()
  accessor freezeValue = -1;

  @property({ reflect: true, type: Boolean })
  accessor showDownArrow = true;

  @property()
  set values(values: EnumValue[]) {
    this.#values = values;
    if (this.#value) {
      this.#selected = this.#values.findIndex((v) => v.id === this.#value);
      if (this.#selected === -1) {
        this.#selected = 0;
      }
      this.#highlighted = this.#selected;
    } else {
      this.#selected = 0;
      this.#highlighted = 0;
    }
  }
  get values() {
    return this.#values;
  }

  @property()
  set value(value: string) {
    this.#value = value;
    this.#selected = this.#values.findIndex((v) => v.id === value);
    if (this.#selected === -1) {
      this.#selected = 0;
    }
    this.#highlighted = this.#selected;
  }
  get value() {
    return this.#values[this.#selected]?.id ?? "";
  }

  static styles = [
    MaterialIcons,
    css`
      :host {
        display: block;
        position: relative;
        --menu-width: 280px;
        --menu-item-column-gap: var(--bb-grid-size-3);
        --selected-item-column-gap: var(--bb-grid-size-3);
        --selected-item-height: var(--bb-grid-size-7);
        --selected-item-hover-color: transparent;
        --selected-item-border-radius: var(--bb-grid-size);
        --selected-item-font: normal var(--bb-label-medium) /
          var(--bb-label-line-height-medium) var(--bb-font-family);
        --selected-item-title-padding: 0;
      }

      :host([transparent]) {
        & button.selected {
          background-color: transparent;

          &:not([disabled]) {
            &:focus,
            &:hover {
              background-color: var(--selected-item-hover-color);
            }
          }
        }
      }

      :host([showdownarrow]) button.selected {
        grid-template-columns: minmax(0, 1fr) 20px;

        &.icon:not(.tag) {
          grid-template-columns: 20px minmax(0, 1fr) 20px;
          padding-right: 0;
        }
      }

      button {
        font: normal var(--bb-label-medium) / var(--bb-label-line-height-medium)
          var(--bb-font-family);
        height: var(--bb-grid-size-7);
        border: none;
        background-color: transparent;
        border-radius: var(--bb-grid-size);
        text-align: left;
        transition: background-color 0.2s cubic-bezier(0, 0, 0.3, 1);
        color: var(--bb-neutral-900);
        width: 100%;
        display: grid;
        align-items: center;
        padding-left: var(--bb-grid-size-3);
        padding-right: var(--bb-grid-size-3);

        &.tag {
          .i-tag {
            color: var(--bb-neutral-500);
          }
        }

        &.icon:not(.tag) {
          grid-template-columns: 20px minmax(0, 1fr);
        }

        &.tag:not(.icon) {
          grid-template-columns: minmax(0, 1fr) max-content;
        }

        &.tag.icon {
          grid-template-columns: 20px minmax(0, 1fr) max-content;
        }

        &:not([disabled]) {
          cursor: pointer;

          &.active {
            background-color: var(--bb-neutral-50);
          }
        }

        &.double {
          height: var(--bb-grid-size-13);
          padding-top: var(--bb-grid-size-2);
          padding-bottom: var(--bb-grid-size-2);
        }

        & .title,
        & .description {
          white-space: nowrap;
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        & .title {
          font-weight: 500;
        }

        & .description {
          color: var(--bb-neutral-700);
          font: normal var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
        }

        &.selected {
          background: var(--bb-neutral-50);
          width: max-content;
          max-width: 100%;
          height: var(--selected-item-height);
          border-radius: var(--selected-item-border-radius);

          & .title {
            font: var(--selected-item-font);
            padding: var(--selected-item-title-padding);
          }

          &.icon .title {
            margin-left: var(--selected-item-column-gap);
          }
        }
      }

      #item-selector {
        position: fixed;
        left: var(--left);
        background: var(--bb-neutral-0);
        padding: var(--bb-grid-size);
        width: var(--menu-width);
        height: fit-content;
        margin: 0;
        border: none;
        overflow: auto;
        color: var(--bb-neutral-900);
        border-radius: var(--bb-grid-size-2);
        box-shadow: var(--bb-elevation-5);

        & .heading {
          color: var(--bb-neutral-500);
          font: normal var(--bb-label-small) / var(--bb-label-line-height-small)
            var(--bb-font-family);
          margin: var(--bb-grid-size-2) var(--bb-grid-size-3);
        }

        & menu {
          padding: 0;
          margin: 0;
          list-style: none;

          & li {
            margin-bottom: var(--bb-grid-size);

            &:last-of-type {
              margin-bottom: 0;
            }

            & button {
              outline: none;
              column-gap: var(--menu-item-column-gap);
            }
          }
        }

        &::backdrop {
          opacity: 0;
        }
      }

      :host([alignment="top"]) #item-selector {
        top: auto;
        bottom: var(--bottom);
      }

      :host([alignment="bottom"]) #item-selector {
        top: var(--top);
        bottom: auto;
      }
    `,
  ];

  #selected = 0;
  #highlighted = 0;
  #value = "";
  #values: EnumValue[] = [];
  #toggleRef: Ref<HTMLButtonElement> = createRef();
  #selectorRef: Ref<HTMLDialogElement> = createRef();

  #handleChange() {
    this.#selected = this.#highlighted;
    if (this.#selectorRef.value) {
      this.#selectorRef.value.close();
    }

    this.dispatchEvent(
      new Event("change", { bubbles: true, composed: true, cancelable: true })
    );
    this.requestUpdate();
  }

  render() {
    const idx = this.freezeValue !== -1 ? this.freezeValue : this.#selected;
    const renderedValue = this.#values[idx] ?? {
      title: "No items available",
      value: "none",
    };
    const classes: Record<string, boolean> = {
      selected: true,
      icon: renderedValue.icon !== undefined,
    };

    return html`<button
        class=${classMap(classes)}
        @click=${() => {
          if (!this.#selectorRef.value) {
            return;
          }

          this.#selectorRef.value.showModal();
        }}
        ${ref(this.#toggleRef)}
      >
        ${renderedValue.icon
          ? html`<span class="g-icon">${renderedValue.icon}</span>`
          : nothing}
        <span class="title">${renderedValue.title}</span>

        ${this.showDownArrow
          ? html`<span class="g-icon">arrow_drop_down</span>`
          : nothing}
      </button>

      <dialog
        id="item-selector"
        modal
        popover
        ${ref(this.#selectorRef)}
        @keydown=${(evt: KeyboardEvent) => {
          const forwards =
            evt.key === "ArrowDown" || (evt.key === "Tab" && !evt.shiftKey);
          const backwards =
            evt.key === "ArrowUp" || (evt.key === "Tab" && evt.shiftKey);
          if (backwards && this.#highlighted > 0) {
            this.#highlighted--;
            this.requestUpdate();
          }

          if (forwards && this.#highlighted < this.values.length - 1) {
            this.#highlighted++;
            this.requestUpdate();
          }

          if (evt.key === "Enter") {
            evt.preventDefault();
            this.#handleChange();
          }
        }}
        @click=${(evt: PointerEvent) => {
          const [top] = evt.composedPath();
          if (top !== this.#selectorRef.value || !this.#selectorRef.value) {
            return;
          }

          this.#selectorRef.value.close();
        }}
        @beforetoggle=${(evt: ToggleEvent) => {
          this.#highlighted = this.#selected;
          this.requestUpdate();

          if (evt.newState === "closed") {
            return;
          }

          // Position this directly because the relevant CSS properties aren't
          // available everywhere yet.
          if (!this.#toggleRef.value) {
            return;
          }

          const bounds = this.#toggleRef.value.getBoundingClientRect();
          let { left, top, bottom } = bounds;
          if (left + 296 > window.innerWidth) {
            left = window.innerWidth - 296;
          }

          if (top + 360 > window.innerHeight) {
            top = window.innerHeight - 360;
          }

          const adjustment = bounds.height + 8;
          if (this.alignment === "bottom") {
            // Adjust to below the button.
            top += adjustment;
            this.style.setProperty("--top", `${top}px`);
          } else {
            // Adjust so that it's the distance from the viewport bottom.
            bottom = window.innerHeight - bottom + adjustment;
            this.style.setProperty("--bottom", `${bottom}px`);
          }
          this.style.setProperty("--left", `${left}px`);
        }}
      >
        ${this.heading
          ? html`<h1 class="heading">${this.heading}</h1>`
          : nothing}
        <menu>
          ${repeat(
            this.#values,
            (v) => v.id,
            (value, idx) => {
              if (value.hidden) {
                return nothing;
              }

              const classes: Record<string, boolean> = {
                double: value.description !== undefined,
                icon: value.icon !== undefined,
                tag: value.tag !== undefined,
                active: idx === this.#highlighted,
              };

              return html`<li>
                <button
                  ?autofocus=${idx === this.#highlighted}
                  @pointerover=${() => {
                    this.#highlighted = idx;
                    this.requestUpdate();
                  }}
                  @click=${() => {
                    this.#handleChange();
                  }}
                  class=${classMap(classes)}
                >
                  ${value.icon
                    ? html`<span class="g-icon">${value.icon}</span>`
                    : nothing}
                  <span>
                    <span class="title">${value.title}</span>

                    ${value.description
                      ? html`<span class="description"
                          >${value.description}</span
                        >`
                      : nothing}
                  </span>
                  ${value.tag
                    ? html`<span class="i-tag">${value.tag}</span>`
                    : nothing}
                </button>
              </li>`;
            }
          )}
        </menu>
      </dialog>`;
  }
}
