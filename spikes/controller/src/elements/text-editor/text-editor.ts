/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { html, css, nothing } from "lit";
import { customElement, query } from "lit/decorators.js";
import { Root } from "../root";
import { isHydrating } from "../../controller/utils/hydration";
import * as Styles from "../../styles/styles";

// Regex to find tokens like {{chip:anything}} or {{chip:foo}}
// We use capturing groups () to ensure the split includes the separators
const TOKEN_REGEX = /(\{\{chip:[^}]+\}\})/g;

function parseTextToParts(text: string) {
  return text.split(TOKEN_REGEX).map((part) => {
    if (part.startsWith("{{chip:")) {
      const mode = part.replace("{{chip:", "").replace("}}", "");
      return { type: "chip", mode, token: part };
    }
    return { type: "text", content: part };
  });
}

function serializeDomToString(rootNode: Node): string {
  let result = "";
  rootNode.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.hasAttribute("data-token")) {
        result += el.getAttribute("data-token");
      } else {
        result += el.textContent;
      }
    }
  });
  return result;
}

function getCaretIndex(root: ShadowRoot, element: HTMLElement): number {
  if (!("getSelection" in root)) return 0;

  // @ts-expect-error New API.
  const selection = root.getSelection();

  // If no selection or selection is outside our editor, return 0
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !element.contains(selection.anchorNode)
  ) {
    return 0;
  }

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();

  // Select everything from the start of the editor up to the cursor
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  // The length of the string representation is our index
  return preCaretRange.toString().length;
}

function setCaretIndex(root: ShadowRoot, element: HTMLElement, index: number) {
  if (!("getSelection" in root)) return;

  // @ts-expect-error New API.
  const selection = root.getSelection();
  if (!selection) return;

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null
  );

  let currentLength = 0;
  let node: Node | null = null;
  let found = false;

  while ((node = walker.nextNode())) {
    // We treat chips as having length of their text content
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      // If it's a chip or other element we treat as a block
      if (el.hasAttribute("data-token")) {
        const len = el.textContent?.length || 0;
        if (index <= currentLength + len) {
          // If the cursor falls "inside" the chip, put it after the chip
          const range = document.createRange();
          range.setStartAfter(el);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          found = true;
          break;
        }
        currentLength += len;
      }
      continue;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;

      if (index <= currentLength + len) {
        const offset = index - currentLength;
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        found = true;
        break;
      }

      currentLength += len;
    }
  }

  // Fallback: If index is beyond total length (e.g. typing at very end),
  // place cursor at the end of the editor.
  if (!found) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false); // Collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

@customElement("text-editor")
export class TextEditor extends Root {
  static styles = [
    Styles.Theme.colorScheme,
    css`
      * {
        box-sizing: border-box;
      }

      :host {
        display: block;
        width: 100%;
      }

      #editor {
        display: block;
        border: 1px solid grey;
        width: 100%;
        border-radius: 8px;
        padding: 8px;
        white-space: pre-wrap;
        min-height: 1em;
        outline: none;
        font-size: 16px;
        line-height: 24px;
      }

      .chip {
        display: inline-flex;
        align-items: center;
        padding: 0 8px;
        height: 18px;
        line-height: 1;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        margin: 0 4px;
        user-select: none;
        vertical-align: middle;
        background: #333;
        color: white;
        border: 1px solid #000;

        &:selected {
          background: red;
        }
      }

      .text-span {
        display: inline;
      }
    `,
  ];

  @query("#editor")
  accessor editorRef!: HTMLDivElement;

  // We keep a local reference to avoid "jumping" when the signal updates
  // from our own typing.
  private lastRenderedValue = "";

  render() {
    if (!this.controller) return nothing;

    // We only render the container ONCE.
    // We do NOT map children here. Lit is banned from inside the editor.
    return html`
      <span
        id="editor"
        contenteditable="${!isHydrating(this.controller.text.textValue)}"
        @input=${this.handleInput}
      ></span>
    `;
  }

  // Lit Lifecycle: Called after render() and after every Signal update
  protected updated(): void {
    if (!this.controller || !this.editorRef || !this.shadowRoot) return;

    const currentValue = this.controller.text.textValue;
    if (currentValue === this.lastRenderedValue) return;

    // Save Cursor
    const caretPos = getCaretIndex(this.shadowRoot, this.editorRef);

    // Rebuild DOM
    this.reconcileDOM(currentValue);
    this.lastRenderedValue = currentValue;

    // Restore Cursor
    if (this.shadowRoot.activeElement !== this.editorRef) {
      return;
    }
    setCaretIndex(this.shadowRoot, this.editorRef, caretPos);
  }

  reconcileDOM(textValue: string) {
    const parts = parseTextToParts(textValue);

    this.editorRef.innerHTML = "";
    parts.forEach((part) => {
      if (part.type === "chip") {
        const span = document.createElement("span");
        span.className = `chip ${part.mode}`;
        span.contentEditable = "false";
        span.setAttribute("data-token", part.token!);
        span.textContent = part.mode!;
        this.editorRef.appendChild(span);
      } else {
        const span = document.createElement("span");
        span.className = "text-span";
        span.textContent = part.content!;
        this.editorRef.appendChild(span);
      }
    });
  }

  handleInput = () => {
    if (!this.controller) return;
    const newValue = serializeDomToString(this.editorRef);
    this.lastRenderedValue = newValue;
    this.controller.text.setTextValue(newValue);
  };
}
