/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { EditorView, minimalSetup } from "codemirror";
import { keymap, hoverTooltip, Tooltip, showTooltip } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import {
  autocompletion,
  closeBrackets,
  CompletionContext,
} from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { CodeChangeEvent } from "../events/events";
import { TypeScriptEnv } from "../typescript-env";
import { EditorState, type Extension, StateField } from "@codemirror/state";
import { Task } from "@lit/task";

type ValidSignatureTriggerCharacter = "," | "(" | "<";

type ValidCompletionsTriggerCharacter =
  | "."
  | '"'
  | "'"
  | "`"
  | "/"
  | "@"
  | "<"
  | "#"
  | " ";

function isValidCompletionCharacter(
  char: string
): char is ValidCompletionsTriggerCharacter {
  return (
    char === "." ||
    char === '"' ||
    char === "'" ||
    char === "`" ||
    char === "/" ||
    char === "@" ||
    char === "<" ||
    char === "#" ||
    char === " "
  );
}

function isValidSignatureCharacter(
  char: string
): char is ValidSignatureTriggerCharacter {
  return char === "," || char === "(" || char === "<";
}

@customElement("bb-code-editor")
export class CodeEditor extends LitElement {
  @property()
  language: "javascript" | "typescript" | "json" = "javascript";

  @property()
  showMessage = false;

  #editor: EditorView | null = null;
  #content: Ref<HTMLDivElement> = createRef();
  #value: string | null = null;
  #message = "";

  #fileName = "index.ts";
  #typeScriptEnv: TypeScriptEnv | null = null;
  #languageTask = new Task(this, {
    task: async ([language]) => {
      let env = null;
      if (language === "typescript") {
        env = await import("../typescript-env/index.js")
          .then((module) => module.TypeScriptEnv)
          .then((TypeScriptEnv) => {
            const env = new TypeScriptEnv();
            return env.ready.then(() => env);
          });
      }

      return env;
    },
    args: () => [this.language],
  });

  static styles = css`
    :host {
      display: block;
      font-size: 11px;
      position: relative;
      color: var(--bb-neutral-900);
      font: 400 var(--bb-body-small) / var(--bb-body-line-height-small)
        var(--bb-font-family);
    }

    .cm-tooltip {
      border-radius: var(--bb-grid-size);
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

  connectedCallback(): void {
    super.connectedCallback();

    window.addEventListener("dblclick", () => {
      this.#typeScriptEnv!.getCompiledFileContents(this.#fileName);
    });
  }

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

  get compiledValue() {
    if (!this.#typeScriptEnv) {
      return this.#value;
    }

    return this.#typeScriptEnv.getFileContents(this.#fileName);
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

    if (this.#typeScriptEnv) {
      this.#typeScriptEnv.updateFile(this.#fileName, this.#value || "");
    }
  }

  #createEditor(maybeTypeScriptEnv: TypeScriptEnv | null): void {
    this.#typeScriptEnv = maybeTypeScriptEnv;

    const extensions: Extension[] = [
      minimalSetup,
      closeBrackets(),
      keymap.of([indentWithTab]),
      EditorView.updateListener.of((value) => {
        if (!value.docChanged || !this.#typeScriptEnv) {
          return;
        }

        const contents = value.state.doc.toString();
        this.#typeScriptEnv.updateFile(this.#fileName, contents);
        this.dispatchEvent(new CodeChangeEvent());
      }),
    ];

    switch (this.language) {
      case "typescript": {
        if (!this.#typeScriptEnv) {
          throw new Error("TypeScript editor started without language support");
        }

        this.#typeScriptEnv.createFile(this.#fileName, "// Connected.");

        const tsTheme = EditorView.baseTheme({
          ".signature": {
            padding: "8px",
          },

          ".signature p": {
            margin: "0 0 4px 0",
            fontWeight: "bold",
          },

          ".signature .active": {
            fontWeight: "bold",
            marginRight: "4px",
          },

          ".signature span::after": {
            content: "",
          },
        });

        const tsCompletions = (context: CompletionContext) => {
          const lastCharacterTyped = context.matchBefore(/./)?.text;
          if (
            !lastCharacterTyped ||
            !isValidCompletionCharacter(lastCharacterTyped)
          ) {
            return null;
          }

          const cursorPosition = context.pos;
          const completions = this.#typeScriptEnv!.getCompletionsAtPosition(
            this.#fileName,
            cursorPosition,
            lastCharacterTyped
          );

          if (!completions || completions.entries.length === 0) {
            return null;
          }

          return {
            from: cursorPosition,
            options: completions.entries.map((entry) => {
              return {
                label: entry.name,
                displayLabel: entry.name,
                type: entry.kind,
              };
            }),
          };
        };

        const showQuickInfo = hoverTooltip((_view, pos) => {
          const env = this.#typeScriptEnv!;
          const quickInfo = env.getQuickInfoAtPosition(this.#fileName, pos);

          if (
            !quickInfo?.documentation ||
            quickInfo?.documentation.length === 0
          ) {
            return null;
          }

          return {
            pos,
            above: true,
            create() {
              const dom = env.connvertToDOM(quickInfo);
              return { dom };
            },
          };
        });

        const getSignatureTooltips = (
          state: EditorState
        ): readonly Tooltip[] => {
          const pos = state.selection.main.to;
          const triggerCharacter = state.doc.sliceString(pos - 1, pos);

          if (!isValidSignatureCharacter(triggerCharacter)) {
            return [];
          }

          // Force-update the file before attempting to ask any questions of the
          // signature helper.
          this.#typeScriptEnv!.updateFile(this.#fileName, state.doc.toString());
          const signatureInfo = this.#typeScriptEnv!.getSignatureHelp(
            this.#fileName,
            pos,
            {
              kind: "characterTyped",
              triggerCharacter,
            }
          );

          if (!signatureInfo) {
            return [];
          }

          return [
            {
              pos,
              above: true,
              strictSide: true,
              arrow: true,
              create: () => {
                const dom =
                  this.#typeScriptEnv!.convertSignatureInfoToDOM(signatureInfo);
                return { dom };
              },
            },
          ];
        };

        const signatureTooltip = StateField.define<readonly Tooltip[]>({
          create: getSignatureTooltips,
          update(tooltips, transaction) {
            if (!transaction.docChanged && !transaction.selection) {
              return tooltips;
            }

            return getSignatureTooltips(transaction.state);
          },
          provide(field) {
            return showTooltip.computeN([field], (state) => state.field(field));
          },
        });

        extensions.push(
          javascript({ typescript: true }),
          autocompletion({
            aboveCursor: true,
            activateOnTyping: true,
            override: [tsCompletions],
          }),
          showQuickInfo,
          signatureTooltip,
          tsTheme
        );
        break;
      }

      case "javascript": {
        extensions.push(javascript());
        break;
      }

      case "json": {
        extensions.push(json());
        break;
      }
    }

    this.#editor = new EditorView({
      extensions,
      parent: this.#content.value,
    });

    this.#attemptEditorUpdate();
  }

  render() {
    const showMessage = this.showMessage;
    const message = this.#message;
    const content = this.#content;
    const createEditor = this.#createEditor.bind(this);

    return this.#languageTask.render({
      pending() {
        return html`Loading editor...`;
      },
      complete(maybeTypeScriptEnv) {
        // Wait for the render to complete before making the editor.
        requestAnimationFrame(() => {
          createEditor(maybeTypeScriptEnv);
        });

        return html` ${showMessage
            ? html`<div class="validation-message">${message}</div>`
            : nothing}
          <div ${ref(content)}></div>`;
      },
      error() {
        return html`Unable to load editor`;
      },
    });
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
