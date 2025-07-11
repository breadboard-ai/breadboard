/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import { icons } from "../../styles/icons.js";
import { colorsLight } from "../../styles/host/colors-light.js";
import { type } from "../../styles/host/type.js";

/**
 * TODO(aomarks) Replace with some proper HTML, but that requires switching to a
 * contenteditable approach. Since we need chips too, let's actually embed (or
 * merge with) bb-text-editor, which already does contenteditable very well.
 */
const TEMPORARY_TAB_ICON_TEXT = " ⇥";

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

  @property({ type: Boolean })
  accessor disabled = false;

  @property({ type: Boolean })
  accessor tabCompletesPlaceholder = false;

  #measure = createRef<HTMLElement>();
  #textarea = createRef<HTMLTextAreaElement>();
  #resizeObserver = new ResizeObserver(() => this.#recomputeHeight());

  static override styles = [
    icons,
    colorsLight,
    type,
    css`
      :host {
        --min-lines: 3;
        --max-lines: 10;
        padding: 0.5lh;
        border: 1px solid currentColor;
        border-radius: 0.5lh;
        overflow-y: hidden;
      }

      #outer-container {
        display: flex;
        align-items: center;
        --line-height: 24px;
      }

      #inner-container {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        margin: var(--bb-grid-size-2);
      }

      textarea,
      #measure {
        line-height: var(--line-height);
        word-break: normal;
        white-space: normal;
        letter-spacing: normal;
        word-spacing: normal;
      }

      textarea {
        flex: 1;
        padding: 0;
        color: inherit;
        background: transparent;
        height: min(
          var(--max-lines) * var(--line-height),
          max(var(--num-lines, 1), var(--min-lines, 1)) * var(--line-height)
        );
        border: none;
        resize: none;
        overflow-y: auto;
        scrollbar-color: #e1e1e1 transparent;
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
        border: none;
        white-space: pre-wrap;
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
        color: var(--n-60);
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: -4px;
      }

      #submit:hover {
        color: var(--n-30);
      }

      ::slotted(.g-icon) {
        font-size: 22px;
      }
    `,
  ];

  override connectedCallback() {
    super.connectedCallback();
    this.#resizeObserver.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#resizeObserver.disconnect();
  }

  override updated(changes: PropertyValues<this>) {
    if (changes.has("value") || changes.has("placeholder")) {
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
            class="sans-flex w-500 round md-body-large"
            .value=${this.value}
            .placeholder=${this.tabCompletesPlaceholder
              ? this.placeholder + TEMPORARY_TAB_ICON_TEXT
              : this.placeholder}
            .disabled=${this.disabled}
            @input=${this.#onInput}
            @keydown=${this.#onKeydown}
          ></textarea>
          <div
            id="measure"
            class="sans-flex w-500 round md-body-large"
            ${ref(this.#measure)}
          ></div>
        </div>
        <slot name="mic"></slot>
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
    } else if (
      this.tabCompletesPlaceholder &&
      event.key === "Tab" &&
      this.placeholder &&
      this.#textarea.value &&
      !this.#textarea.value.value
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.value = this.#textarea.value.value = this.placeholder;
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
    measure.textContent =
      textarea.value ||
      (this.tabCompletesPlaceholder
        ? this.placeholder + TEMPORARY_TAB_ICON_TEXT
        : this.placeholder);
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
