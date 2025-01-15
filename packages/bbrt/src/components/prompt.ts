/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalWatcher } from "@lit-labs/signals";
import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";
import type { Conversation } from "../llm/conversation.js";

@customElement("bbrt-prompt")
export class BBRTPrompt extends SignalWatcher(LitElement) {
  @property({ attribute: false })
  accessor conversation: Conversation | undefined = undefined;

  @property()
  accessor value: string = "";

  #measure = createRef<HTMLElement>();
  #textarea = createRef<HTMLTextAreaElement>();

  static override styles = css`
    :host {
      --bbrt-prompt-padding: 0.6em;
      --bbrt-prompt-line-height: 1.3em;
      --bbrt-prompt-max-lines: 10;
      font-size: 16px;
      font-weight: 400;
      font-family: Helvetica, sans-serif;
    }
    #container {
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    textarea,
    #measure {
      line-height: var(--bbrt-prompt-line-height);
      font-size: inherit;
      font-weight: inherit;
      font-family: inherit;
      word-break: break-all;
      white-space: pre-wrap;
    }
    textarea {
      flex: 1;
      background: #f0f4f9;
      border-radius: 14px;
      padding: var(--bbrt-prompt-padding);
      height: min(
        var(--bbrt-prompt-max-lines) * var(--bbrt-prompt-line-height),
        var(--num-lines, 1) * var(--bbrt-prompt-line-height)
      );
      border: none;
      resize: none;
    }
    #measure {
      visibility: hidden;
      margin: var(--bbrt-prompt-padding);
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
  `;

  override updated(changes: PropertyValues<this>) {
    if (changes.has("value")) {
      this.updateComplete.then(() => this.#recomputeHeight());
    }
  }

  override render() {
    if (this.conversation === undefined) {
      return html`Waiting for conversation...`;
    }
    return html`
      <div id="container">
        <textarea
          ${ref(this.#textarea)}
          placeholder="Ask me about Breadboard"
          @keydown=${this.#onKeydown}
          @input=${this.#recomputeHeight}
          .value=${this.value}
        ></textarea>
        <div id="measure" ${ref(this.#measure)}></div>
      </div>
    `;
  }

  focus() {
    this.#textarea.value?.focus();
  }

  #onKeydown(event: KeyboardEvent & { target: HTMLTextAreaElement }) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (this.conversation?.status === "ready" && event.target.value) {
        const textarea = event.target;
        void this.conversation.send(textarea.value);
        textarea.value = "";
        textarea.style.setProperty("--num-lines", "1");
      }
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
}

declare global {
  interface HTMLElementTagNameMap {
    "bbrt-prompt": BBRTPrompt;
  }
}
