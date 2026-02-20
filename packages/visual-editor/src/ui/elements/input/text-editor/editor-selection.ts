/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * # EditorSelection — DOM Selection Bridge for the Text Editor
 *
 * ## Big Picture
 *
 * This module bridges between the browser's Selection/Range APIs and the
 * abstract coordinate system used by `EditorModel`. The model thinks in
 * terms of "visible-text character offsets" (where chiclets are zero-width);
 * the browser thinks in terms of DOM nodes and text offsets within those
 * nodes. This class translates between the two.
 *
 * ## Why is this hard?
 *
 * A `contenteditable` span with interleaved text nodes and chiclet `<label>`
 * elements creates several challenges:
 *
 * 1. **ZWNBSPs**: The render layer inserts invisible zero-width no-break
 *    space characters (U+FEFF) around chiclets as "cursor landing pads".
 *    These exist in the DOM but not in the model, so every offset conversion
 *    must skip them.
 *
 * 2. **Lit comment markers**: Lit inserts `<!-- -->` comment nodes between
 *    template parts as boundary markers. These inflate the child count of
 *    the editor element but don't correspond to model segments. We skip
 *    them with `nextSignificantSibling` / `prevSignificantSibling`.
 *
 * 3. **Shadow DOM**: The component lives inside a shadow root. The
 *    `Selection` API behaves differently across browsers in shadow DOM:
 *    Chrome/Firefox support `shadowRoot.getSelection()`, while Safari
 *    falls back to `document.getSelection()`. Similarly,
 *    `caretPositionFromPoint` needs the `shadowRoots` option in Chrome
 *    to penetrate shadow boundaries during drag operations.
 *
 * 4. **Chiclet cursor ambiguity**: Because chiclets are zero-width,
 *    adjacent chiclets create multiple DOM positions that map to the same
 *    visible-text offset. The `afterChiclet` flag throughout the codebase
 *    resolves this ambiguity by specifying which side of a chiclet
 *    boundary the cursor should be on.
 *
 * ## Cursor Clamping ("Safe Positions")
 *
 * The `ensureSafePosition()` method prevents the cursor from landing in
 * the "danger zone" — the space between a ZWNBSP and its adjacent chiclet.
 * If the cursor were allowed there, the next keystroke could produce
 * unexpected behavior (e.g. text inserted between the ZWNBSP and the
 * chiclet, where it would be invisible or misplaced). The method pushes
 * the cursor to the user-facing side of the ZWNBSP after arrow key
 * navigation, delete, and other cursor-moving operations.
 *
 * ## Design: DOM-Coupled but Testable
 *
 * Pure offset helpers (like `charOffsetToRawOffset()` and the sibling
 * navigation functions) are extracted as module-level functions that don't
 * need DOM access. The class instance methods are inherently DOM-coupled
 * (they read Selection/Range state), but the separation keeps the testable
 * surface as large as possible.
 */

import { Template } from "@breadboard-ai/utils";
import type { Segment } from "./editor-model.js";
import { ZWNBSP, ZWNBSP_RE, stripZWNBSP } from "./constants.js";

export { EditorSelection };
export type { CursorSnapshot };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A snapshot of the cursor position in model-space coordinates.
 * Used to save/restore cursor position across re-renders.
 */
interface CursorSnapshot {
  /** Index into the render-segments array (which child of the editor). */
  segmentIndex: number;
  /** Character offset within the segment's text (text segments only). */
  offset: number;
}

/**
 * Returned by the cross-browser `caretPositionFromPoint` helper.
 * Normalizes the different return types of `document.caretPositionFromPoint`
 * (returns `CaretPosition` with `offsetNode`) and `document.caretRangeFromPoint`
 * (returns `Range` with `startContainer`) into a single interface.
 */
interface CaretPosition {
  node: Node;
  offset: number;
}

// ---------------------------------------------------------------------------
// Pure offset helpers (testable without DOM)
// ---------------------------------------------------------------------------

/**
 * Return the next non-comment sibling, skipping Lit's marker comments.
 *
 * Lit inserts `<!-- -->` comment nodes between rendered template parts as
 * boundary markers. When navigating the DOM sibling chain (e.g. to find
 * the text node after a chiclet), we need to skip these invisible markers
 * so we land on a "real" node (text node or element).
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
 * Mirror of `nextSignificantSibling` for backward navigation.
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
 *
 * This is a **render-segment-aware** version of the mapping — it operates
 * on the render segments (which include ZWNBSPs) and strips them during
 * the character count. The model has its own version
 * (`EditorModel.charOffsetToRawOffset`) that works on clean model segments.
 *
 * @param segments The **render** segments (with ZWNBSP padding).
 * @param charOffset The visible-text offset to map.
 * @returns The corresponding offset in the raw template string.
 */
function charOffsetToRawOffset(
  segments: Segment[],
  charOffset: number
): number {
  let charRun = 0;
  let rawRun = 0;

  for (const seg of segments) {
    if (seg.kind === "text") {
      // Strip ZWNBSPs to get the "real" visible character count.
      const clean = seg.text.replace(ZWNBSP_RE, "");
      if (charRun + clean.length >= charOffset) {
        return rawRun + (charOffset - charRun);
      }
      charRun += clean.length;
      rawRun += clean.length;
    } else {
      // Chiclet: zero-width in visible space, full JSON length in raw space.
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
 * This class acts as a DOM adapter: the component tells it "place the cursor
 * at visible-text offset 12" and it figures out which DOM text node and at
 * what text offset within that node corresponds to position 12, accounting
 * for ZWNBSP padding, Lit comment markers, and chiclet `<label>` elements.
 *
 * It also provides the reverse mapping: given a browser Range, compute the
 * visible-text offset (for feeding back into the model on user input).
 */
class EditorSelection {
  /** The component's shadow root, used for `getSelection()`. */
  #shadowRoot: ShadowRoot;

  /**
   * Lazy accessor for the editor `<span>` element. This is a function
   * (rather than a stored reference) because the element may not exist
   * yet at construction time — it's created during Lit's first render.
   */
  #editorEl: () => HTMLElement | undefined;

  constructor(shadowRoot: ShadowRoot, editorEl: () => HTMLElement | undefined) {
    this.#shadowRoot = shadowRoot;
    this.#editorEl = editorEl;
  }

  // -------------------------------------------------------------------------
  // Cross-browser Selection access
  // -------------------------------------------------------------------------

  /**
   * Get the current Selection object, accounting for shadow DOM differences.
   *
   * - **Chrome/Firefox**: `shadowRoot.getSelection()` returns the selection
   *   scoped to this shadow root. This is the preferred path because it
   *   correctly reflects selections within the shadow DOM.
   *
   * - **Safari**: does not support `shadowRoot.getSelection()`, so we fall
   *   back to `document.getSelection()` which works for most cases but can't
   *   fully distinguish selections across shadow boundaries.
   */
  getSelection(): Selection | null {
    if ("getSelection" in this.#shadowRoot) {
      // @ts-expect-error New API not yet in all type definitions.
      return this.#shadowRoot.getSelection() as Selection | null;
    }

    return document.getSelection();
  }

  /**
   * Get the current Range from the selection, or null if no selection exists.
   * Convenience wrapper around `getSelection().getRangeAt(0)`.
   */
  getRange(): Range | null {
    const selection = this.getSelection();
    if (!selection) return null;
    return selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  }

  /**
   * Check whether a Range is still valid (its ancestor is within the editor).
   * Ranges can become invalid if the DOM was re-rendered since the range
   * was captured, or if the range belongs to a different part of the page.
   */
  isRangeValid(range: Range): boolean {
    return this.#editorEl()?.contains(range.commonAncestorContainer) ?? false;
  }

  // -------------------------------------------------------------------------
  // Cursor snapshot / restore
  // -------------------------------------------------------------------------

  /**
   * Snapshot the current cursor position as a model-space offset
   * (segment index + character offset within that segment).
   *
   * This walks the editor's child nodes to find which one contains the
   * Range's start position, returning the child index (= segment index)
   * and the offset within that child.
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
   *
   * This scans backward through the editor's children looking for the
   * last chiclet, then places the cursor at offset 1 in the following
   * text node (offset 1 = just past the ZWNBSP that serves as the
   * chiclet's trailing cursor landing pad).
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
   * Place the cursor at a specific DOM node + text offset.
   *
   * This is the lowest-level cursor placement method — all other cursor
   * methods eventually delegate here. It creates a collapsed Range at
   * the specified position and replaces the current selection with it.
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
   * Convert a browser Range's start position to a visible-text character
   * offset (where ZWNBSPs are excluded and chiclets are zero-width).
   *
   * ### How it works
   *
   * Walk the editor's child nodes in order. For each child *before* the one
   * containing the Range's start, add its visible text length to the running
   * offset. For the child *containing* the Range's start, count only the
   * visible characters up to the Range's start offset.
   *
   * ### Special case: Range container is the editor itself
   *
   * When the user does Cmd+A (select all), the browser may set the Range's
   * startContainer to the editor element itself, with startOffset being a
   * *child index* rather than a text offset. We handle this by counting
   * visible characters across children up to that index.
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
        // Chiclets and comments contribute zero visible characters.
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
          // Count only visible (non-ZWNBSP) characters up to the cursor
          // position within this text node.
          const text = child.textContent ?? "";
          for (let i = 0; i < range.startOffset && i < text.length; i++) {
            if (text[i] !== ZWNBSP) {
              offset++;
            }
          }
        }
        // Found the container — stop walking.
        break;
      }

      // This child is entirely before the Range — add its full visible length.
      if (child.nodeType === Node.TEXT_NODE) {
        offset += stripZWNBSP(child.textContent ?? "").length;
      }
    }

    return offset;
  }

  /**
   * Compute the character offset from a DOM node + text offset directly.
   *
   * This is identical in logic to `rangeToCharOffset` but accepts a raw
   * DOM node + offset instead of a Range object. This is needed for
   * `caretPositionFromPoint` results during drag operations, where we get
   * a node+offset from the browser's hit-testing API rather than from the
   * current Selection.
   *
   * The separation exists because `caretPositionFromPoint` can return nodes
   * inside the shadow DOM that may not be reachable through the standard
   * Selection API, making it unsafe to construct a Range from them.
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
   *
   * Delegates to the module-level pure function. This instance method exists
   * to expose the functionality through the EditorSelection interface for
   * callers that already have a reference to the selection object.
   */
  charOffsetToRawOffset(segments: Segment[], charOff: number): number {
    return charOffsetToRawOffset(segments, charOff);
  }

  /**
   * Place the cursor at a character offset in the visible text.
   *
   * ### Algorithm
   *
   * Walk the editor's child nodes (the rendered DOM), skipping chiclet
   * `<label>` elements and Lit comment markers. For each text node, count
   * visible characters (skipping ZWNBSPs) until we've consumed `charOffset`
   * characters, then place the cursor at that DOM position.
   *
   * ### The `afterChiclet` flag
   *
   * When a chiclet sits at a boundary, the same visible-text offset maps to
   * two DOM positions: the end of the text node *before* the chiclet, or
   * the start of the text node *after* it. The `afterChiclet` flag resolves
   * this: when `true`, we advance past the chiclet to place the cursor in
   * the following text node (at offset 1, past the ZWNBSP landing pad).
   *
   * This is critical after deletion: if you backspace a character and the
   * cursor ends up at a chiclet boundary, it should stay on the *same side*
   * as the deleted text, not jump to the other side of the chiclet.
   */
  setCursorAtCharOffset(charOffset: number, afterChiclet = false): void {
    const editor = this.#editorEl();
    if (!editor) return;

    let remaining = charOffset;
    const children = Array.from(editor.childNodes);

    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci];

      if (isChicletNode(child)) {
        // Chiclets are zero-width — skip them entirely.
        continue;
      }

      if (child.nodeType !== Node.TEXT_NODE) {
        // Skip Lit comment markers and other non-text nodes.
        continue;
      }

      const text = child.textContent ?? "";
      // Walk through the text node character by character, counting only
      // visible (non-ZWNBSP) characters.
      let visibleConsumed = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ZWNBSP) continue;
        if (visibleConsumed === remaining) {
          // Found the exact position — place cursor here.
          this.#setCursorAt(child, i);
          return;
        }
        visibleConsumed++;
      }

      // If we consumed exactly `remaining` chars, cursor is at end of node.
      if (visibleConsumed === remaining) {
        // When afterChiclet is requested, check if a chiclet follows.
        // If so, advance past it to the next text node so the cursor
        // appears on the far side of the chiclet.
        if (afterChiclet) {
          const nextSig = nextSignificantSibling(child);
          if (nextSig && isChicletNode(nextSig)) {
            const afterNode = nextSignificantSibling(nextSig);
            if (afterNode && afterNode.nodeType === Node.TEXT_NODE) {
              // Offset 1 = just past the ZWNBSP landing pad.
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
   *
   * This tells the model "the cursor is in segment N", which is used as
   * the `segmentHint` for `EditorModel.insertTextAtOffset()` to disambiguate
   * zero-width gaps between adjacent chiclets.
   *
   * Skips Lit comment nodes (which inflate the child count but don't
   * correspond to model segments) so the returned index matches the model
   * segment array.
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
   *
   * ### The Problem
   *
   * Each chiclet has a ZWNBSP text node on either side as a cursor landing
   * pad. The cursor can legally sit at several positions within these text
   * nodes, but only the **user-facing side** is correct:
   *
   * ```
   *   ... text [ZWNBSP] <chiclet> [ZWNBSP] text ...
   *             ^safe                ^safe
   *                    ^danger  ^danger
   * ```
   *
   * If the cursor sits in the "danger" zone (between a ZWNBSP and a chiclet),
   * the next keystroke produces confusing behavior — text appears to be
   * inserted inside the chiclet.
   *
   * ### Per-key behavior
   *
   * - **ArrowLeft**: If the cursor is at the start of a text node that follows
   *   a chiclet, jump over the chiclet to the end of the previous text node.
   * - **ArrowRight**: If at the end of a text node preceding a chiclet, jump
   *   over to the start of the next text node.
   * - **Delete/Backspace**: Clamp position but let the model handle deletion
   *   (chiclet deletion is done by `#onBeforeInput` through the model).
   * - **Enter**: Prevent the cursor from sitting between ZWNBSP and chiclet
   *   when inserting a newline.
   * - **Default**: For any other key, just ensure we're not in the danger zone.
   *
   * @returns `true` if the cursor was clamped (the event may have been
   *   `preventDefault()`ed), `false` otherwise.
   */
  /* c8 ignore start — deeply coupled to live Selection/Range interaction */
  ensureSafePosition(evt?: KeyboardEvent): boolean {
    const selection = this.getSelection();
    const range = this.getRange();

    // Only clamp when the cursor is collapsed (no selection range).
    // When there's a selection, the start/end are different and clamping
    // individual endpoints would break the selection.
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

    /**
     * Helper: move the cursor to a safe position within a node.
     * Optionally prevents the default behavior of the triggering event
     * (used for arrow keys where we're overriding the browser's native
     * cursor movement).
     */
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

    // Check neighbors using helpers that skip Lit comment markers.
    const nextSig = nextSignificantSibling(focusedNode);
    const prevSig = prevSignificantSibling(focusedNode);
    const nextSiblingIsChiclet = isChicletNode(nextSig);
    const previousSiblingIsChiclet = isChicletNode(prevSig);
    const textContent = focusedNode.textContent!;

    /**
     * Generic safety check: if the cursor is at the end of a text node
     * that precedes a chiclet, pull it back by 1 (to the user-facing side
     * of the ZWNBSP). If at the start of a text node that follows a chiclet,
     * push it forward by 1.
     */
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
        // If cursor is near the start of a text node after a chiclet,
        // jump over the chiclet to the previous text node's safe position.
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
        // If cursor is near the end of a text node before a chiclet,
        // jump over the chiclet to the next text node's safe position.
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
        // Chiclet deletion is handled by #onBeforeInput through the model.
        // Here we just clamp the cursor so the delete targets the right thing.
        if (focusedOffset <= 1 && previousSiblingIsChiclet) {
          updateRange(focusedNode, 0);
          handled = true;
        }
        break;
      }

      case "Enter": {
        // Prevent newline from being inserted between ZWNBSP and chiclet.
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

  /**
   * If the pointer landed on a chiclet, toggle its "selected" CSS class
   * and set the browser selection to cover the entire chiclet node.
   *
   * This gives chiclets a visual "selected" state when clicked, and
   * ensures the browser's Selection encompasses the chiclet so that
   * subsequent Delete/Backspace operations can detect and remove it.
   */
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

  /**
   * Remove the "selected" CSS class from all chiclets in the editor.
   * Called at the start of each pointer interaction to reset visual state
   * before potentially selecting new chiclets.
   */
  clearChicletSelections(): void {
    const editor = this.#editorEl();
    if (!editor) return;
    for (const child of editor.childNodes) {
      if (child instanceof HTMLElement && child.classList.contains("chiclet")) {
        child.classList.remove("selected");
      }
    }
  }

  /**
   * Sync chiclet "selected" visual state with the current browser Selection.
   *
   * When the user drags to create a text selection that spans chiclets,
   * this method marks each chiclet as "selected" if the Selection range
   * intersects it. This gives visual feedback that the chiclet is part
   * of the selection and will be affected by delete/cut operations.
   */
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
   *
   * Note: this is a legacy DOM-level insertion method. The primary tab
   * insertion path now goes through the model (`insertTextAtOffset`), with
   * this method available as a direct-DOM fallback.
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
   *
   * Used when a "Go to" step chiclet is clicked to select it before
   * opening the fast access menu to pick a route destination.
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
   * Restore a previously stored Range into the browser selection.
   *
   * When `offsetLastChar` is true (the default), the range's start position
   * is pulled back by one character. This is used when restoring the cursor
   * position for fast access chiclet insertion: the stored range points to
   * the '@' trigger character, and we want the cursor just before it so the
   * chiclet replaces the '@'.
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

  /**
   * Move focus to the editor and place the cursor at the very end of
   * all content. Also scrolls the editor to the bottom so the cursor
   * is visible.
   *
   * Used when the component's `focus()` method is called externally
   * (e.g. when the user clicks into the editor area).
   */
  focusEnd(): void {
    const editor = this.#editorEl();
    if (!editor || !editor.lastChild) return;

    const selection = this.getSelection();
    if (!selection) return;

    const range = new Range();
    range.selectNodeContents(editor);
    range.collapse(false); // Collapse to end.
    selection.removeAllRanges();
    selection.addRange(range);

    editor.scrollTop = editor.scrollHeight;
    editor.focus();
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Check whether a DOM node is a chiclet `<label>`.
 *
 * Chiclets are rendered as `<label class="chiclet" contenteditable="false">`
 * elements within the editor. This type guard is used throughout the
 * selection logic to distinguish chiclets from text nodes when walking
 * the editor's child list.
 */
function isChicletNode(node: Node | null): node is HTMLElement {
  return node instanceof HTMLElement && node.classList.contains("chiclet");
}

/**
 * Cross-browser caret-from-point. Returns the DOM node + offset at
 * the given viewport coordinates.
 *
 * ### Why two code paths?
 *
 * - `document.caretPositionFromPoint` (standards track, Firefox/Chrome): returns
 *   a `CaretPosition` with `offsetNode`. Chrome supports a `shadowRoots` option
 *   that lets us penetrate into shadow DOM boundaries — critical because the
 *   editor lives in a shadow root, and without this option, the returned node
 *   would be the shadow host rather than the internal text node.
 *
 * - `document.caretRangeFromPoint` (Safari, legacy Chrome): returns a Range
 *   at the point. Does not support shadow DOM penetration.
 *
 * This is used during chiclet drag-and-drop to determine where the dragged
 * chiclet would be dropped based on the pointer position.
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
