/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { EditorView, minimalSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { closeBrackets } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";

@customElement("bb-code-editor")
export class CodeEditor extends LitElement {
  #editor: EditorView | null = null;
  #content: Ref<HTMLDivElement> = createRef();
  #value: string | null = null;

  static styles = css`
    :host {
      display: block;
      font-size: 11px;
    }

    .cm-editor {
      border-radius: var(--bb-grid-size);
      background: rgb(255, 255, 255);
      padding: var(--bb-input-padding, calc(var(--bb-grid-size) * 2));
      border: 1px solid rgb(209, 209, 209);
    }

    .cm-editor.cm-focused {
      outline: none;
      border: 1px solid var(--bb-ui-700);
      box-shadow: inset 0 0 0 1px var(--bb-ui-700);
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
    this.#editor = new EditorView({
      extensions: [
        minimalSetup,
        javascript(),
        closeBrackets(),
        keymap.of([indentWithTab]),
        EditorView.updateListener.of((update) => {
          const isDeletion =
            update.changes.desc.newLength < update.changes.desc.length;
          if (!isDeletion) {
            return;
          }

          this.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              composed: true,
              cancelable: true,
            })
          );
        }),
      ],
      parent: this.#content.value,
    });

    this.#attemptEditorUpdate();
  }

  render() {
    return html`<div ${ref(this.#content)}></div>`;
  }
}
