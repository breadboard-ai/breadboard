/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { icons } from "../../styles/icons.js";

/**
 * A text input which grows to fit its content.
 *
 * Use the "submit" slot to set the config icon, e.g.:
 *   <span slot="submit" class="g-icon">spark</span>
 *
 * Use the `--min-lines` and `--max-lines` CSS custom properties to configure
 * the height (relative to `line-height`).
 *
 * Use the `color` CSS property to set the text, border, and icon colors
 * together; or set them individually.
 *
 * Use the `textarea` part if you need to insert custom styles for the inner
 * <textarea> element.
 */
@customElement("bb-expanding-textarea")
export class ExpandingTextarea extends LitElement {
  @property()
  accessor value = "";

  @property()
  accessor placeholder = "";

  @property({ type: Boolean, reflect: true })
  accessor disabled = false;

  #measure = createRef<HTMLElement>();
  #textarea = createRef<HTMLTextAreaElement>();

  static override styles = [
    icons,
    css`
      :host {
        --min-lines: 3;
        --max-lines: 10;
        padding: 0.5lh;
        border: 1px solid currentColor;
        border-radius: 0.5lh;
        overflow-y: hidden;
      }
      :host([disabled]) {
        textarea {
          color: rgb(from currentColor r g b / 50%);
          cursor: wait;
        }
        #submit {
          cursor: wait;
        }
      }
      #outer-container {
        display: flex;
        align-items: flex-end;
        --line-height: 1lh;
      }
      #inner-container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
      }
      textarea,
      #measure {
        line-height: var(--line-height);
        font-size: inherit;
        font-weight: inherit;
        font-family: inherit;
        word-break: break-all;
        white-space: pre-wrap;
      }
      textarea {
        flex: 1;
        color: inherit;
        background: transparent;
        height: min(
          var(--max-lines) * var(--line-height),
          max(var(--num-lines, 1), var(--min-lines, 1)) * var(--line-height)
        );
        border: none;
        resize: none;
        overflow-y: auto;
      }
      textarea:focus-visible {
        outline: none;
      }
      #measure {
        visibility: hidden;
        color: magenta;
        pointer-events: none;
        position: absolute;
        user-select: none;
        top: 0;
        left: 0;
      }
      #measure::after {
        /* Unlike our <textarea>, our measurement <div> won't claim height for
         trailing newlines. We can work around this by appending a zero-width
         space. */
        content: "\u200B";
      }
      #submit {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--submit-button-color, inherit);
        padding: 4px;
        display: flex;
        margin: -4px;
      }
      #submit:hover {
        filter: brightness(125%);
      }
    `,
  ];

  updated(changes: PropertyValues<this>) {
    if (changes.has("value")) {
      this.updateComplete.then(() => this.#recomputeHeight());
    }
  }

  override render() {
    return html`
      <div id="outer-container">
        <div id="inner-container">
          <textarea
            ${ref(this.#textarea)}
            part="textarea"
            .value=${this.value}
            .placeholder=${this.placeholder}
            .disabled=${this.disabled}
            @input=${this.#onInput}
            @keydown=${this.#onKeydown}
          ></textarea>
          <div id="measure" ${ref(this.#measure)}></div>
        </div>
        <button id="submit" aria-label="Submit" @click=${this.#submit}>
          <slot name="submit">
            <span class="g-icon">spark</span>
          </slot>
        </button>
      </div>
    `;
  }

  async focus() {
    if (this.isUpdatePending) {
      // Handle the case where disabled has been set to false, and then focus()
      // was called, but before this element has a chance to update the internal
      // disabled state of the textarea (which will prevent focus while true).
      await this.updateComplete;
    }
    this.#textarea.value?.focus();
  }

  #onInput() {
    this.value = this.#textarea.value?.value ?? "";
    this.#recomputeHeight();
  }

  #onKeydown(event: KeyboardEvent & { target: HTMLTextAreaElement }) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#submit();
    }
  }

  #submit() {
    const value = this.#textarea?.value?.value;
    if (value && !this.disabled) {
      this.dispatchEvent(new InputEvent("change"));
    } else {
      this.#shake();
    }
  }

  #recomputeHeight() {
    // The "measure" <div> is used to measure the actual rendered height of the
    // text. We can't measure the <textarea> directly, because the case where
    // there is 1 line is indistinguishable from 2 lines.
    const textarea = this.#textarea.value;
    const measure = this.#measure.value;
    if (!textarea || !measure) {
      return;
    }
    measure.textContent = textarea.value;
    // Instead of directly matching the height, round to the nearest number of
    // lines, and then multiply by line height. This ensures our height is
    // always a multiple of line height, and accounts for tiny rendering
    // differences between the <div> and <textarea> (there seemed to be 1px
    // differences sometimes).
    const lineHeight = parseFloat(getComputedStyle(measure).lineHeight);
    const numLines = Math.round(measure.scrollHeight / lineHeight);
    textarea.style.setProperty("--num-lines", `${numLines}`);
  }

  #shake() {
    const numShakes = 3;
    const distance = 3;
    const duration = 200;
    const keyframes = [];
    keyframes.push({ transform: "translateX(0)" });
    for (let i = 0; i < numShakes; i++) {
      keyframes.push(
        { transform: `translateX(${-distance}px)` },
        { transform: `translateX(${distance}px)` }
      );
    }
    keyframes.push({ transform: "translateX(0)" });
    this.animate(keyframes, { duration, easing: "ease-in-out" });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bb-expanding-textarea": ExpandingTextarea;
  }
}
