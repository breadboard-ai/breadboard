/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { EditorView, minimalSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { closeBrackets } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { CodeChangeEvent } from "../../../events/events.js";

@customElement("bb-code-editor")
export class CodeEditor extends LitElement {
  @property()
  language: "javascript" | "json" = "javascript";

  @property()
  showMessage = false;

  @property({ reflect: true })
  passthru = false;

  #editor: EditorView | null = null;
  #content: Ref<HTMLDivElement> = createRef();
  #value: string | null = null;
  #message = "";

  #onKeyUpBound = this.#onKeyUp.bind(this);

  static styles = css`
    :host {
      display: block;
      font-size: 11px;
      position: relative;
    }

    .cm-editor {
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      padding: var(--bb-grid-size-2);
      border: 1px solid rgb(209, 209, 209);
    }

    .cm-editor.cm-focused {
      outline: none;
      border: 1px solid var(--bb-ui-700);
      box-shadow: inset 0 0 0 1px var(--bb-ui-700);
    }

    :host([passthru="true"]) .cm-editor {
      border: 1px solid transparent;
    }

    :host([passthru="true"]) .cm-editor.cm-focused {
      border: 1px solid transparent;
      box-shadow: none;
    }

    textarea {
      background: rgb(255, 255, 255);
      border-radius: var(--bb-grid-size);
      border: 1px solid rgb(209, 209, 209);
      box-sizing: border-box;
      display: block;
      field-sizing: content;
      font-family: var(--bb-font-family-mono);
      font-size: var(--bb-body-small);
      line-height: var(--bb-body-line-height-small);
      max-height: 300px;
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      resize: none;
      width: 100%;
    }

    .validation-message {
      padding: var(--bb-grid-size-2);
      background: var(--bb-warning-100);
      border: 1px solid var(--bb-warning-300);
      color: var(--bb-warning-700);
      pointer-events: none;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      position: absolute;
      top: 0px;
      left: 0;
      transform: translate(4px, -100%) translate(0, -12px);
      width: min(calc(100% - var(--bb-grid-size-7)), 360px);
      border-radius: var(--bb-grid-size-2);
      opacity: 0;
      animation: fade 0.3s cubic-bezier(0, 0, 0.3, 1) forwards;
    }

    @keyframes fade {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }
  `;

  set value(value: string | null) {
    this.#value = value;
    this.#attemptEditorUpdate();
  }

  get value() {
    if (!this.#editor) {
      return null;
    }

    this.#value = this.#editor.state.doc.toString();
    return this.#value;
  }

  #attemptEditorUpdate() {
    if (!this.#editor) {
      return;
    }

    const state = this.#editor.state;
    const transaction = state.update({
      changes: { from: 0, to: state.doc.length, insert: this.#value || "" },
    });

    this.#editor.dispatch(transaction);
  }

  protected firstUpdated(): void {
    const lang = this.language === "javascript" ? javascript : json;

    this.#editor = new EditorView({
      extensions: [
        minimalSetup,
        lang(),
        closeBrackets(),
        keymap.of([indentWithTab]),
      ],
      parent: this.#content.value,
    });

    this.#attemptEditorUpdate();
  }

  #onKeyUp() {
    this.dispatchEvent(new CodeChangeEvent());
  }

  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener("keyup", this.#onKeyUpBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();

    this.removeEventListener("keyup", this.#onKeyUpBound);
  }

  render() {
    return html` ${this.showMessage
        ? html`<div class="validation-message">${this.#message}</div>`
        : nothing}
      <div ${ref(this.#content)}></div>`;
  }

  destroy() {
    if (!this.#editor) {
      return;
    }

    this.#editor.destroy();
    this.#editor = null;
  }

  setCustomValidity(message: string) {
    if (message === this.#message) {
      return;
    }

    if (message === "") {
      this.showMessage = false;
    }

    this.#message = message;
  }

  reportValidity() {
    if (this.#message === "") {
      return;
    }

    this.showMessage = true;
  }

  checkValidity() {
    return this.#message === "";
  }
}
