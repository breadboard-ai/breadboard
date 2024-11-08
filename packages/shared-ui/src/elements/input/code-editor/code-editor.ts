/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { EditorView, minimalSetup } from "codemirror";
import { keymap, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import {
  CodeChangeEvent,
  ToastEvent,
  ToastType,
} from "../../../events/events.js";
import { type Extension } from "@codemirror/state";

import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { CodeMirrorExtensions } from "../../../types/types.js";
import type { HoverInfo } from "@valtown/codemirror-ts";

const CODE_CHANGE_EMIT_TIMEOUT = 500;

@customElement("bb-code-editor")
export class CodeEditor extends LitElement {
  @property()
  language: "javascript" | "typescript" | "json" | null = null;

  @property()
  definitions: Map<string, string> | null = null;

  @property()
  showMessage = false;

  @property({ reflect: true })
  passthru = false;

  @property()
  fileName: string | null = null;

  @property()
  env: VirtualTypeScriptEnvironment | null = null;

  @property()
  extensions: CodeMirrorExtensions | null = null;

  #editor: EditorView | null = null;
  #content: Ref<HTMLDivElement> = createRef();
  #value: string | null = null;
  #message = "";
  #shouldCreateEditorOnUpdate = false;
  #onKeyDownBound = this.#onKeyDown.bind(this);

  static styles = css`
    :host {
      display: block;
      font-size: 11px;
      position: relative;
    }

    .cm-gutters {
      border-radius: var(--bb-grid-size) 0 0 var(--bb-grid-size);
    }

    .cm-editor {
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0);
      border: 1px solid var(--bb-neutral-300);
    }

    .cm-editor.cm-focused {
      outline: none;
      border: 1px solid var(--bb-ui-700);
      box-shadow: 0 0 0 1px var(--bb-ui-700);
    }

    :host([passthru="true"]) .cm-editor {
      border: none;
    }

    :host([passthru="true"]) .cm-editor.cm-focused {
      border: none;
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

    .cm-tooltip {
      padding: var(--bb-grid-size);
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0) !important;
      border: 1px solid var(--bb-neutral-300) !important;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family-mono);

      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);
    }
  `;

  #emitTimeout = -1;
  #lastCursorPosition: number | undefined = undefined;

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

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("keydown", this.#onKeyDownBound);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.#onKeyDownBound);
  }

  #onKeyDown(evt: KeyboardEvent) {
    const isMac = navigator.platform.indexOf("Mac") === 0;
    const isCtrlCommand = isMac ? evt.metaKey : evt.ctrlKey;

    if (evt.key !== "s" || !isCtrlCommand) {
      return;
    }

    evt.preventDefault();
    evt.stopImmediatePropagation();

    this.#lastCursorPosition = this.#editor?.state.selection.main.head;

    this.dispatchEvent(new ToastEvent("Code updated", ToastType.INFORMATION));
    this.dispatchEvent(new CodeChangeEvent(true));
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

    const lastCursorPosition = this.#lastCursorPosition;
    this.#lastCursorPosition = undefined;

    // Ensure we're not setting the cursor outside of the available range.
    if (
      !lastCursorPosition ||
      lastCursorPosition > this.#editor.state.doc.length
    ) {
      return;
    }

    this.#editor.dispatch({
      selection: {
        anchor: lastCursorPosition,
        head: lastCursorPosition,
      },
    });
  }

  #attemptEditorFocus() {
    if (!this.#editor) {
      return;
    }

    this.#editor.focus();
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (changedProperties.has("language")) {
      this.#shouldCreateEditorOnUpdate = true;
    }
  }

  protected updated(): void {
    if (!this.#shouldCreateEditorOnUpdate) {
      return;
    }

    this.destroy();
    this.#createEditor();
  }

  #createEditor() {
    const editorExtensions: Extension[] = [
      minimalSetup,
      lineNumbers(),
      closeBrackets(),
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((value) => {
        if (!value.docChanged) {
          return;
        }

        globalThis.clearTimeout(this.#emitTimeout);
        this.#emitTimeout = setTimeout(() => {
          this.dispatchEvent(new CodeChangeEvent());
        }, CODE_CHANGE_EMIT_TIMEOUT);
      }),
    ];

    switch (this.language) {
      case "typescript": {
        if (!this.env || !this.extensions || !this.fileName) {
          throw new Error("TypeScript editor started without language support");
        }

        const { tsFacet, tsSync, tsLinter, tsAutocomplete, tsHover } =
          this.extensions;

        editorExtensions.push(
          javascript({ typescript: true }),
          tsFacet.of({ env: this.env, path: this.fileName }),
          tsSync(),
          tsLinter(),
          autocompletion({ override: [tsAutocomplete()] }),
          tsHover({
            renderTooltip: (info: HoverInfo) => {
              const div = document.createElement("div");
              div.className = "hover";
              if (info.quickInfo?.displayParts) {
                for (const part of info.quickInfo.displayParts) {
                  const span = div.appendChild(document.createElement("span"));
                  span.className = `quick-info-${part.kind}`;
                  span.innerText = part.text;
                }
              }
              return { dom: div };
            },
          })
        );
        break;
      }

      case "javascript": {
        editorExtensions.push(javascript());
        break;
      }

      case "json": {
        editorExtensions.push(json());
        break;
      }
    }

    this.#editor = new EditorView({
      extensions: editorExtensions,
      parent: this.#content.value,
    });

    this.#attemptEditorUpdate();
    this.#attemptEditorFocus();
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
