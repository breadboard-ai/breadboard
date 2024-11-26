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
import { continueKeymap } from "@valtown/codemirror-continue";
import { closeSearchPanel, openSearchPanel, search } from "@codemirror/search";
import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  closeCompletion,
  completionStatus,
  moveCompletionSelection,
  startCompletion,
} from "@codemirror/autocomplete";
import {
  cursorLineDown,
  cursorLineUp,
  indentLess,
  indentMore,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { CodeChangeEvent } from "../../../events/events.js";
import { type Extension } from "@codemirror/state";

import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { CodeMirrorExtensions } from "../../../types/types.js";
import type { HoverInfo } from "@valtown/codemirror-ts";

const CODE_CHANGE_EMIT_TIMEOUT = 500;
const CODE_INDENTATION = 2;

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

    .cm-lintRange-error {
      position: relative;
    }

    .cm-lintRange-error::before {
      content: "";
      position: absolute;
      left: -2px;
      top: -2px;
      bottom: -2px;
      right: -2px;
      border-radius: var(--bb-grid-size);
      background: oklch(from var(--bb-warning-500) l c h / 0.15);
      z-index: -1;
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

    .cm-editor .cm-panels {
      z-index: 1;
    }

    .cm-editor .cm-panel.cm-search {
      display: grid;
      grid-template-columns: repeat(7, max-content) auto;
      grid-auto-rows: var(--bb-grid-size-5);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      color: var(--bb-neutral-800);
      column-gap: var(--bb-grid-size-2);
      row-gap: var(--bb-grid-size);
      padding: var(--bb-grid-size-2);
      background: var(--bb-neutral-0);
    }

    .cm-editor .cm-panel.cm-search label {
      display: flex;
      align-items: center;
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .cm-editor .cm-panel.cm-search input.cm-textfield,
    .cm-editor .cm-panel.cm-search button.cm-button {
      padding: 0 var(--bb-grid-size-2);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
      border-radius: var(--bb-grid-size);
      border: 1px solid var(--bb-neutral-300);
      background: var(--bb-neutral-0);
      margin: 0;
    }

    .cm-editor .cm-panel.cm-search button.cm-button {
      border-radius: var(--bb-grid-size-12);
      background: var(--bb-ui-100);
      color: var(--bb-ui-700);
      border: none;
    }

    .cm-editor .cm-panel.cm-search br {
      flex: 1 0 auto;
    }

    .cm-editor .cm-panel.cm-search button[name="close"] {
      width: 20px;
      height: 20px;
      background: var(--bb-icon-close) center center / 20px 20px no-repeat;
      font-size: 0;
    }

    .cm-tooltip {
      border-radius: var(--bb-grid-size);
      background: var(--bb-neutral-0) !important;
      border: 1px solid var(--bb-neutral-300) !important;
      font: 500 var(--bb-body-x-small) / var(--bb-body-line-height-x-small)
        monospace;
      white-space: nowrap;
      box-shadow:
        0 8px 8px 0 rgba(0, 0, 0, 0.07),
        0 15px 12px 0 rgba(0, 0, 0, 0.09);
      line-height: 1.8;
      color: rgb(0, 0, 204);
    }

    .hover {
      padding: var(--bb-grid-size-2);
    }

    .hover span {
      margin: 0 1ch 0 0;
    }

    .hover span.no-margin,
    .hover span.quick-info-indentation,
    .hover span:has(+ .quick-info-punctuation) {
      margin-right: 0;
    }

    .hover span.enforce-margin:has(+ .quick-info-punctuation) {
      margin-right: 1ch;
    }

    .quick-info-punctuation {
      color: rgb(0, 0, 0);
    }

    .quick-info-functionName,
    .quick-info-keyword {
      color: rgb(119, 0, 136);
    }

    .quick-info-aliasName {
      color: rgb(0, 136, 85);
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

    if (evt.shiftKey) {
      return;
    }

    if (evt.key !== "s" || !isCtrlCommand) {
      return;
    }

    evt.preventDefault();
    evt.stopImmediatePropagation();

    this.#lastCursorPosition = this.#editor?.state.selection.main.head;

    this.dispatchEvent(new CodeChangeEvent({ format: true, manual: true }));
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

    if (!lastCursorPosition) {
      return;
    }

    this.gotoLocation(lastCursorPosition);
  }

  attemptEditorFocus() {
    if (!this.#editor) {
      return;
    }

    this.#editor.focus();
  }

  gotoLocation(location: number) {
    if (!this.#editor) {
      return;
    }

    // Ensure we're not setting the cursor outside of the available range.
    if (!location || location > this.#editor.state.doc.length) {
      return;
    }

    this.#editor.dispatch({
      selection: {
        anchor: location,
        head: location,
      },
      effects: [
        EditorView.scrollIntoView(location, { y: "start", yMargin: 100 }),
      ],
    });
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
    const maybeAutoComplete = (view: EditorView) => {
      // If there are completions, assume that tab is to be used,
      // otherwise indent the content.
      if (completionStatus(view.state) === null) {
        return indentMore(view);
      }

      return acceptCompletion(view);
    };

    const editorExtensions: Extension[] = [
      keymap.of([
        ...continueKeymap,
        {
          key: "Tab",
          preventDefault: true,
          shift: indentLess,
          run: maybeAutoComplete,
        },
        {
          key: "ArrowDown",
          preventDefault: true,
          run(view: EditorView) {
            if (completionStatus(view.state) === "active") {
              return moveCompletionSelection(true, "option")(view);
            }

            return cursorLineDown(view);
          },
        },
        {
          key: "ArrowUp",
          preventDefault: true,
          run(view: EditorView) {
            if (completionStatus(view.state) === "active") {
              return moveCompletionSelection(false, "option")(view);
            }

            return cursorLineUp(view);
          },
        },
        {
          key: "Enter",
          preventDefault: true,
          run(view: EditorView) {
            if (completionStatus(view.state) === null) {
              return insertNewlineAndIndent(view);
            }

            return acceptCompletion(view);
          },
        },
        {
          key: "Mod-Shift-Space",
          preventDefault: true,
          run: startCompletion,
        },
        {
          key: "Escape",
          preventDefault: true,
          run(view: EditorView) {
            if (completionStatus(view.state) !== null) {
              return closeCompletion(view);
            }

            return closeSearchPanel(view);
          },
        },
        {
          key: "Mod-f",
          preventDefault: true,
          run: openSearchPanel,
        },
      ]),
      minimalSetup,
      lineNumbers(),
      closeBrackets(),
      bracketMatching(),
      search({ top: true }),
      EditorView.theme({
        "&": {
          fontSize: "11.75px",
        },
        ".cm-scroller": {
          fontWeight: 400,
          lineHeight: 1.8,
        },
      }),

      EditorView.updateListener.of((value) => {
        if (!value.docChanged) {
          return;
        }

        globalThis.clearTimeout(this.#emitTimeout);
        this.#emitTimeout = setTimeout(() => {
          const opts: {
            format?: boolean;
            manual?: boolean;
            errors?: number;
            errorsDetail?: Array<{ message: string; start: number }>;
          } = { format: false, manual: false };
          if (this.env && this.fileName) {
            const errorsDetail = [
              ...this.env.languageService.getSemanticDiagnostics(this.fileName),
              ...this.env.languageService.getSyntacticDiagnostics(
                this.fileName
              ),
            ].map((value) => {
              let messageText = value.messageText;
              if (typeof messageText !== "string") {
                messageText = messageText.messageText;
              }

              return {
                message: messageText,
                start: value.start ?? 0,
              };
            });

            opts.errors = errorsDetail.length;
            opts.errorsDetail = errorsDetail;
          }

          this.dispatchEvent(new CodeChangeEvent(opts));
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
          autocompletion({
            override: [tsAutocomplete()],
            defaultKeymap: false,
          }),
          tsHover({
            renderTooltip: (info: HoverInfo) => {
              const div = document.createElement("div");
              div.className = "hover";
              if (info.quickInfo?.displayParts) {
                const parts = info.quickInfo.displayParts.filter(
                  (p) => p.kind !== "space"
                );
                let indentation = 0;
                for (let p = 0; p < parts.length; p++) {
                  const part = parts[p];
                  const text = part.text;

                  // Create the container span.
                  const span = div.appendChild(document.createElement("span"));
                  span.className = `quick-info-${part.kind}`;
                  if (text === "(" || text === ")") {
                    span.classList.add("no-margin");
                  }

                  if (text === ":") {
                    span.classList.add("enforce-margin");
                  }

                  span.innerText = text;

                  // Now handle indentation.
                  if (
                    p < parts.length - 1 &&
                    (parts[p + 1].kind === "lineBreak" ||
                      parts[p + 1].kind === "punctuation")
                  ) {
                    // { followed by a new line indents more.
                    const nextPart = parts[p + 1];
                    if (part.text === "{" && nextPart.kind === "lineBreak") {
                      indentation++;
                    }

                    // }; and } followed by a new line indents less.
                    if (part.kind === "lineBreak" && nextPart.text === "}") {
                      indentation--;
                    }
                  }

                  // Make sure to clamp in case of negative indentation (which
                  // ideally shouldn't happen, but best to be sure).
                  indentation = Math.max(0, indentation);

                  // Finally, if we have a line break inject a span with the
                  // requisite amount of
                  if (part.kind === "lineBreak") {
                    const span = div.appendChild(
                      document.createElement("span")
                    );
                    span.className = `quick-info-indentation`;
                    span.innerHTML = "&nbsp;".repeat(
                      indentation * CODE_INDENTATION
                    );
                  }
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

    this.#editor.scrollDOM.addEventListener("dragover", (evt) => {
      evt.preventDefault();
      evt.stopImmediatePropagation();
    });

    this.#editor.scrollDOM.addEventListener("drop", (evt) => {
      evt.preventDefault();
      evt.stopImmediatePropagation();
      console.log(evt);
    });

    this.#attemptEditorUpdate();
    this.attemptEditorFocus();
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
