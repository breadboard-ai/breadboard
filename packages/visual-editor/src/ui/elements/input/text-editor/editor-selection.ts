/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template } from "@breadboard-ai/utils";
import type { Segment } from "./editor-model.js";
import { ZWNBSP, ZWNBSP_RE, stripZWNBSP } from "./constants.js";

export { EditorSelection };
export type { CursorSnapshot };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CursorSnapshot {
  /** Index into the render-segments array. */
  segmentIndex: number;
  /** Character offset within the segment's text (text segments only). */
  offset: number;
}

/** Returned by the cross-browser caret-from-point helper. */
interface CaretPosition {
  node: Node;
  offset: number;
}

// ---------------------------------------------------------------------------
// Pure offset helpers (testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Return the next non-comment sibling, skipping Lit's marker comments.
 */
function nextSignificantSibling(node: Node | null): Node | null {
  let current = node?.nextSibling ?? null;
  while (current && current.nodeType === Node.COMMENT_NODE) {
    current = current.nextSibling;
  }
  return current;
}

/**
 * Return the previous non-comment sibling, skipping Lit's marker comments.
 */
function prevSignificantSibling(node: Node | null): Node | null {
  let current = node?.previousSibling ?? null;
  while (current && current.nodeType === Node.COMMENT_NODE) {
    current = current.previousSibling;
  }
  return current;
}

/**
 * Map a character offset in the visible text (where chiclets are zero-width)
 * to an offset in the raw template string (where chiclets are their full
 * `{JSON}` representation).
 */
function charOffsetToRawOffset(
  segments: Segment[],
  charOffset: number
): number {
  let charRun = 0;
  let rawRun = 0;

  for (const seg of segments) {
    if (seg.kind === "text") {
      const clean = seg.text.replace(ZWNBSP_RE, "");
      if (charRun + clean.length >= charOffset) {
        return rawRun + (charOffset - charRun);
      }
      charRun += clean.length;
      rawRun += clean.length;
    } else {
      const partStr = Template.part(seg.part);
      rawRun += partStr.length;
    }
  }

  return rawRun;
}

// ---------------------------------------------------------------------------
// EditorSelection
// ---------------------------------------------------------------------------

/**
 * Encapsulates all cursor, selection, and offset logic for the text editor.
 *
 * Separates pure offset computations (testable without DOM) from the thin
 * DOM adapter layer that bridges to the browser's Range/Selection APIs.
 */
class EditorSelection {
  #shadowRoot: ShadowRoot;
  #editorEl: () => HTMLElement | undefined;

  constructor(shadowRoot: ShadowRoot, editorEl: () => HTMLElement | undefined) {
    this.#shadowRoot = shadowRoot;
    this.#editorEl = editorEl;
  }

  // -------------------------------------------------------------------------
  // Cross-browser Selection access
  // -------------------------------------------------------------------------

  getSelection(): Selection | null {
    // Chrome/Firefox: shadowRoot.getSelection()
    if ("getSelection" in this.#shadowRoot) {
      // @ts-expect-error New API not yet in all type definitions.
      return this.#shadowRoot.getSelection() as Selection | null;
    }

    // Safari fallback: document.getSelection() works for most use cases.
    return document.getSelection();
  }

  getRange(): Range | null {
    const selection = this.getSelection();
    if (!selection) return null;
    return selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  }

  isRangeValid(range: Range): boolean {
    return this.#editorEl()?.contains(range.commonAncestorContainer) ?? false;
  }

  // -------------------------------------------------------------------------
  // Cursor snapshot / restore
  // -------------------------------------------------------------------------

  /**
   * Snapshot the current cursor position as a model-space offset
   * (segment index + character offset within that segment).
   */
  snapshot(): CursorSnapshot | null {
    const range = this.getRange();
    const editor = this.#editorEl();
    if (!range || !editor) return null;

    const node = range.startContainer;
    const offset = range.startOffset;

    const children = Array.from(editor.childNodes);
    let segmentIndex = 0;
    for (const child of children) {
      if (child === node || child.contains(node)) {
        return { segmentIndex, offset };
      }
      segmentIndex++;
    }

    return null;
  }

  /**
   * After inserting a chiclet, place the cursor in the text node
   * immediately following the last chiclet.
   */
  restoreAfterChicletInsert(): void {
    const editor = this.#editorEl();
    if (!editor) return;

    const children = Array.from(editor.childNodes);
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (isChicletNode(child) && children[i + 1]) {
        const afterNode = children[i + 1];
        if (afterNode.nodeType === Node.TEXT_NODE) {
          this.#setCursorAt(
            afterNode,
            Math.min(1, afterNode.textContent?.length ?? 0)
          );
        }
        break;
      }
    }
  }

  /**
   * Place the cursor at a specific offset within a node.
   */
  #setCursorAt(node: Node, offset: number): void {
    const selection = this.getSelection();
    if (!selection) return;
    const range = new Range();
    range.setStart(node, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  // -------------------------------------------------------------------------
  // Range ↔ character offset mapping
  // -------------------------------------------------------------------------

  /**
   * Convert the current Range's start position to a character offset
   * within the model's visible text (ZWNBSPs excluded, chiclets zero-width).
   */
  rangeToCharOffset(range: Range | null): number {
    const editor = this.#editorEl();
    if (!range || !editor) return 0;

    // When the container is the editor itself (e.g. Cmd+A selections),
    // startOffset is a child index. Count visible chars up to that child.
    if (range.startContainer === editor) {
      let offset = 0;
      const children = Array.from(editor.childNodes);
      for (let i = 0; i < range.startOffset && i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          offset += stripZWNBSP(child.textContent ?? "").length;
        }
        // Chiclets and comments are zero-width.
      }
      return offset;
    }

    let offset = 0;
    const children = Array.from(editor.childNodes);

    for (const child of children) {
      if (
        child === range.startContainer ||
        child.contains(range.startContainer)
      ) {
        if (child.nodeType === Node.TEXT_NODE) {
          // Count only visible (non-ZWNBSP) characters up to the cursor.
          const text = child.textContent ?? "";
          for (let i = 0; i < range.startOffset && i < text.length; i++) {
            if (text[i] !== ZWNBSP) {
              offset++;
            }
          }
        }
        break;
      }

      if (child.nodeType === Node.TEXT_NODE) {
        offset += stripZWNBSP(child.textContent ?? "").length;
      }
    }

    return offset;
  }

  /**
   * Compute the character offset from a DOM node + text offset directly.
   * Unlike `rangeToCharOffset`, this doesn't require a Range object,
   * making it safe for shadow DOM nodes returned by `caretPositionFromPoint`.
   */
  nodeToCharOffset(targetNode: Node, nodeOffset: number): number {
    const editor = this.#editorEl();
    if (!editor) return 0;

    // When the target is the editor itself, nodeOffset is a child index.
    if (targetNode === editor) {
      let offset = 0;
      const children = Array.from(editor.childNodes);
      for (let i = 0; i < nodeOffset && i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === Node.TEXT_NODE) {
          offset += stripZWNBSP(child.textContent ?? "").length;
        }
      }
      return offset;
    }

    let offset = 0;
    const children = Array.from(editor.childNodes);

    for (const child of children) {
      if (child === targetNode || child.contains(targetNode)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent ?? "";
          for (let i = 0; i < nodeOffset && i < text.length; i++) {
            if (text[i] !== ZWNBSP) {
              offset++;
            }
          }
        }
        break;
      }

      if (child.nodeType === Node.TEXT_NODE) {
        offset += stripZWNBSP(child.textContent ?? "").length;
      }
    }

    return offset;
  }

  /**
   * Map a character offset to a raw template string offset.
   * Pure computation delegated to the module-level helper.
   */
  charOffsetToRawOffset(segments: Segment[], charOff: number): number {
    return charOffsetToRawOffset(segments, charOff);
  }

  /**
   * Place the cursor at a character offset in the visible text.
   * Chiclets are zero-width; ZWNBSPs in the DOM are skipped.
   * If `afterChiclet` is true and the offset lands at a chiclet boundary,
   * place the cursor in the text node AFTER the chiclet.
   */
  setCursorAtCharOffset(charOffset: number, afterChiclet = false): void {
    const editor = this.#editorEl();
    if (!editor) return;

    let remaining = charOffset;
    const children = Array.from(editor.childNodes);

    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci];

      if (isChicletNode(child)) {
        // Chiclets are zero-width — skip them.
        continue;
      }

      if (child.nodeType !== Node.TEXT_NODE) {
        // Skip Lit comment markers and other non-text nodes.
        continue;
      }

      const text = child.textContent ?? "";
      // Compute the visible length (strip ZWNBSPs).
      let visibleConsumed = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ZWNBSP) continue;
        if (visibleConsumed === remaining) {
          this.#setCursorAt(child, i);
          return;
        }
        visibleConsumed++;
      }

      // If we consumed exactly `remaining` chars, cursor is at end of node.
      if (visibleConsumed === remaining) {
        // When afterChiclet is requested, check if a chiclet follows.
        // If so, advance past it to the next text node.
        if (afterChiclet) {
          const nextSig = nextSignificantSibling(child);
          if (nextSig && isChicletNode(nextSig)) {
            const afterNode = nextSignificantSibling(nextSig);
            if (afterNode && afterNode.nodeType === Node.TEXT_NODE) {
              const t = afterNode.textContent ?? "";
              const pos = t.startsWith(ZWNBSP) ? 1 : 0;
              this.#setCursorAt(afterNode, pos);
              return;
            }
          }
        }
        this.#setCursorAt(child, text.length);
        return;
      }

      remaining -= visibleConsumed;
    }

    // Past the end — place cursor at end of last text node.
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (child.nodeType === Node.TEXT_NODE) {
        this.#setCursorAt(child, child.textContent?.length ?? 0);
        return;
      }
    }
  }

  /**
   * Map a DOM node + offset to a render-segment index.
   * Skips Lit comment markers (which inflate the child count)
   * so the returned index matches the model segment array.
   */
  domPositionToSegmentIndex(node: Node, _offset: number): number {
    const editor = this.#editorEl();
    if (!editor) return 0;

    const children = Array.from(editor.childNodes);
    let segmentIndex = 0;
    for (const child of children) {
      // Lit inserts comment nodes as boundary markers between rendered
      // template parts. These don't correspond to model segments.
      if (child.nodeType === Node.COMMENT_NODE) continue;

      if (child === node || child.contains(node)) {
        return segmentIndex;
      }
      segmentIndex++;
    }
    return segmentIndex;
  }

  // -------------------------------------------------------------------------
  // Cursor clamping around chiclets
  // -------------------------------------------------------------------------

  /**
   * Ensure the cursor is in a "safe" position relative to chiclets.
   * The ZWNBSP cursor-landing pads exist to give the caret a text node
   * to rest in, but the cursor should never sit between a ZWNBSP and
   * a chiclet — it should sit on the user-facing side of the ZWNBSP.
   */
  /* c8 ignore start — deeply coupled to live Selection/Range interaction */
  ensureSafePosition(evt?: KeyboardEvent): boolean {
    const selection = this.getSelection();
    const range = this.getRange();

    // Only clamp when the cursor is collapsed (no selection range).
    if (
      range?.startContainer !== range?.endContainer ||
      range?.startOffset !== range?.endOffset
    ) {
      return false;
    }

    const focusedNode = range?.startContainer;
    const focusedOffset = range?.startOffset;

    if (
      focusedOffset === undefined ||
      focusedNode === undefined ||
      focusedNode.nodeType !== Node.TEXT_NODE ||
      !selection ||
      !range
    ) {
      return false;
    }

    const updateRange = (
      node: Node,
      offset: number,
      preventDefault = false
    ) => {
      try {
        range.setStart(node, offset);
        range.setEnd(node, offset);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (err) {
        console.warn("[EditorSelection] Unable to set range", err);
      }
      if (evt && preventDefault) {
        evt.preventDefault();
      }
    };

    // Use helpers that skip Lit comment markers.
    const nextSig = nextSignificantSibling(focusedNode);
    const prevSig = prevSignificantSibling(focusedNode);
    const nextSiblingIsChiclet = isChicletNode(nextSig);
    const previousSiblingIsChiclet = isChicletNode(prevSig);
    const textContent = focusedNode.textContent!;

    const ensureNotBetweenZWNBSPAndChiclet = () => {
      if (textContent.length === focusedOffset && nextSiblingIsChiclet) {
        updateRange(focusedNode, focusedOffset - 1);
      } else if (focusedOffset === 0 && previousSiblingIsChiclet) {
        updateRange(focusedNode, focusedOffset + 1);
      }
    };

    if (!evt) {
      ensureNotBetweenZWNBSPAndChiclet();
      return false;
    }

    let handled = false;
    switch (evt.key) {
      case "ArrowLeft": {
        if (focusedOffset <= 1 && previousSiblingIsChiclet) {
          const prevTextNode = prevSignificantSibling(prevSig);
          if (prevTextNode?.nodeType === Node.TEXT_NODE) {
            updateRange(
              prevTextNode,
              prevTextNode.textContent!.length - 1,
              true
            );
            handled = true;
          }
        }
        break;
      }

      case "ArrowRight": {
        if (focusedOffset === textContent.length - 1 && nextSiblingIsChiclet) {
          const nextTextNode = nextSignificantSibling(nextSig);
          if (nextTextNode?.nodeType === Node.TEXT_NODE) {
            updateRange(nextTextNode, 1, true);
            handled = true;
          }
        }
        break;
      }

      case "Delete":
      case "Backspace": {
        // Chiclet deletion is now handled by #onBeforeInput via the model.
        // Just clamp the cursor position.
        if (focusedOffset <= 1 && previousSiblingIsChiclet) {
          updateRange(focusedNode, 0);
          handled = true;
        }
        break;
      }

      case "Enter": {
        if (focusedOffset === textContent.length && nextSiblingIsChiclet) {
          updateRange(focusedNode, focusedOffset - 1);
        }
        break;
      }

      default: {
        ensureNotBetweenZWNBSPAndChiclet();
        break;
      }
    }

    return handled;
  }
  /* c8 ignore end */

  // -------------------------------------------------------------------------
  // Chiclet selection visual feedback
  // -------------------------------------------------------------------------

  /* c8 ignore start — needs composedPath() from live browser events */
  selectChicletIfPossible(evt: Event): void {
    const [possibleChiclet] = evt.composedPath();
    if (!(possibleChiclet instanceof HTMLElement)) return;
    if (!possibleChiclet.classList.contains("chiclet")) return;

    possibleChiclet.classList.toggle("selected");

    const selection = this.getSelection();
    if (!selection) return;

    const range = new Range();
    range.selectNode(possibleChiclet);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  /* c8 ignore end */

  clearChicletSelections(): void {
    const editor = this.#editorEl();
    if (!editor) return;
    for (const child of editor.childNodes) {
      if (child instanceof HTMLElement && child.classList.contains("chiclet")) {
        child.classList.remove("selected");
      }
    }
  }

  updateChicletSelections(): void {
    const range = this.getRange();
    const editor = this.#editorEl();
    if (!range || !editor) return;

    for (const child of editor.childNodes) {
      if (child instanceof HTMLElement && child.classList.contains("chiclet")) {
        child.classList.toggle("selected", range.intersectsNode(child));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Insertion helpers
  // -------------------------------------------------------------------------

  /**
   * Insert a tab character at the current collapsed caret position.
   * Returns true if a tab was inserted, false otherwise.
   */
  insertTab(): boolean {
    const range = this.getRange();
    if (!range || !range.collapsed) return false;

    const tabNode = document.createTextNode("\t");
    range.insertNode(tabNode);
    range.setStartAfter(tabNode);
    range.setEndAfter(tabNode);

    const selection = this.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    return true;
  }

  /**
   * Programmatically select a DOM node (e.g. a chiclet) so it appears
   * highlighted and the browser's selection covers it.
   */
  selectNode(node: Node): void {
    const selection = this.getSelection();
    if (!selection) return;

    const range = new Range();
    range.selectNode(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Restore a previously stored Range into the browser selection,
   * optionally offsetting it back by one character (used to place the
   * cursor just before a newly inserted chiclet).
   */
  restoreRange(range: Range, offsetLastChar = true): void {
    const selection = this.getSelection();
    if (!selection) return;

    if (range.startOffset > 0 && offsetLastChar) {
      range.setStart(range.startContainer, range.startOffset - 1);
    }

    selection.removeAllRanges();
    try {
      selection.addRange(range);
    } catch (err) {
      console.warn("[EditorSelection] Unable to restore range", err);
    }
  }

  // -------------------------------------------------------------------------
  // Focus management
  // -------------------------------------------------------------------------

  focusEnd(): void {
    const editor = this.#editorEl();
    if (!editor || !editor.lastChild) return;

    const selection = this.getSelection();
    if (!selection) return;

    const range = new Range();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    editor.scrollTop = editor.scrollHeight;
    editor.focus();
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Check whether a DOM node is a chiclet `<label>`. */
function isChicletNode(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.classList.contains("chiclet");
}

/**
 * Cross-browser caret-from-point. Returns the DOM node + offset at
 * the given viewport coordinates.
 *
 * When `shadowRoot` is provided, Chrome's `shadowRoots` option is used
 * so the API can penetrate into shadow DOM and return internal text nodes.
 */
/* c8 ignore start — browser-only API, not available in jsdom */
function caretPositionFromPoint(
  x: number,
  y: number,
  shadowRoot?: ShadowRoot
): CaretPosition | null {
  if ("caretPositionFromPoint" in document) {
    const options = shadowRoot ? { shadowRoots: [shadowRoot] } : undefined;
    const pos = document.caretPositionFromPoint(x, y, options);
    if (pos) {
      return { node: pos.offsetNode, offset: pos.offset };
    }
  }
  if ("caretRangeFromPoint" in document) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      return { node: range.startContainer, offset: range.startOffset };
    }
  }
  return null;
}
/* c8 ignore end */

export {
  isChicletNode,
  caretPositionFromPoint,
  charOffsetToRawOffset,
  nextSignificantSibling,
  prevSignificantSibling,
};
