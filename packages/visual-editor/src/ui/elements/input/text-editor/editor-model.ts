/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * # EditorModel — Pure Data Model for the Text Editor
 *
 * ## Big Picture
 *
 * This module is the **source of truth** for the text editor's content. It
 * operates entirely without DOM dependencies, making it testable in Node.
 *
 * The editor displays a mix of **plain text** and **chiclets** (inline UI
 * pills that represent template parts — references to tools, steps, files,
 * etc.). Under the hood, those are serialized as `{JSON}` placeholders in a
 * raw template string (e.g. `"Hello {{\"path\":\"...\"}} world"`). This model
 * provides a structured representation of that content as an ordered array of
 * `Segment` values.
 *
 * ## Dual Coordinate Systems
 *
 * A key design challenge is that the model maintains **two different
 * coordinate systems**:
 *
 * 1. **Visible-text offsets** — what the user sees and where the cursor moves.
 *    In this system, chiclets are **zero-width**. "Hello [chiclet] world" has
 *    a visible length of 12 ("Hello " + " world"), and the chiclet sits at
 *    offset 6. All cursor-based operations (insert, delete, word boundaries)
 *    use this system.
 *
 * 2. **Raw-template offsets** — the serialized string where chiclets occupy
 *    their full `{JSON}` character count. Paste and clipboard operations need
 *    this system because they splice text into the raw string and re-parse.
 *
 * Methods like `charOffsetToRawOffset()` bridge between the two systems.
 *
 * ## Structural Invariants
 *
 * The segment array always satisfies:
 *
 * - **Text boundaries**: the first and last segments are always text (even if
 *   empty). This guarantees `insertChicletAtOffset(0)` always has a text
 *   segment to split, and `toRenderSegments()` never needs to synthesize
 *   segments that don't exist in the model.
 *
 * - **No adjacent text segments**: after structural mutations (remove, move),
 *   `#mergeAdjacentText()` collapses any runs of consecutive text segments
 *   into one.
 *
 * - **ZWNBSP padding is render-only**: the model stores clean text (no
 *   ZWNBSPs). The `toRenderSegments()` method adds zero-width no-break space
 *   padding around chiclets so the browser always has a text node for the
 *   caret to rest in. This keeps the model simple and the rendering concern
 *   isolated.
 *
 * ## Undo / Redo
 *
 * History is a bounded ring buffer of `Snapshot` values (deep-cloned segment
 * arrays + cursor positions). The component layer (`TextEditorRemix`)
 * debounces typing snapshots (300ms pause) so that individual keystrokes
 * aren't each a separate undo step, but structural edits (chiclet insertion,
 * paste, drag) push immediately.
 */

import { Template, TemplatePart } from "@breadboard-ai/utils";
import { ZWNBSP, ZWNBSP_RE } from "./constants.js";

export { EditorModel };
export type { TextSegment, ChicletSegment, Segment, Snapshot };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A segment of plain text content. */
interface TextSegment {
  kind: "text";
  /** The text content. Never contains ZWNBSPs — those are a rendering concern. */
  text: string;
}

/**
 * A segment representing a chiclet — an inline UI pill in the editor.
 * Chiclets are zero-width in the visible-text coordinate system; they
 * don't contribute to character offsets. Their visual representation is
 * handled by the component layer.
 */
interface ChicletSegment {
  kind: "chiclet";
  /** The underlying template part data (path, title, type, etc.). */
  part: TemplatePart;
}

/**
 * A single piece of editor content — either plain text or a chiclet.
 * The model is an ordered array of these.
 */
type Segment = TextSegment | ChicletSegment;

/**
 * An immutable snapshot of the model state for undo/redo.
 *
 * Each snapshot captures:
 * - A deep clone of all segments (so mutations don't corrupt history).
 * - The cursor offset at the time of the snapshot, enabling cursor restoration
 *   on undo/redo.
 * - Whether the cursor was positioned after a chiclet (needed because a
 *   chiclet boundary is ambiguous — the cursor could be in the text node
 *   before or after the chiclet, both mapping to the same visible offset).
 */
interface Snapshot {
  segments: Segment[];
  cursorOffset: number;
  afterChiclet: boolean;
}

/**
 * Maximum number of undo/redo snapshots to keep. Older entries are discarded
 * (ring buffer semantics) to bound memory usage. 50 is generous enough for
 * typical editing sessions without being wasteful.
 */
const MAX_HISTORY = 50;

/**
 * Pure data model for the text editor's content.
 *
 * Content is an ordered array of `Segment` values — either plain text or
 * chiclets (template parts). The model guarantees structural invariants
 * (e.g. ZWNBSP padding around chiclets) when producing the render-ready view.
 *
 * This class is intentionally DOM-free — all browser interactions (Selection,
 * Range, cursor placement) are handled by the companion `EditorSelection`
 * class. This separation enables unit testing the model in Node without a
 * browser environment.
 */
class EditorModel {
  /** The ordered array of content segments. This is the core data structure. */
  #segments: Segment[];

  /**
   * Undo/redo history. Each entry is a deep clone of the segments array
   * plus cursor position metadata. History is append-only until an undo
   * is performed, at which point redo entries are discarded on the next
   * mutation (standard undo/redo tree-pruning behavior).
   */
  #history: Snapshot[] = [];

  /**
   * Current position in the history stack. Points to the snapshot that
   * represents the current state. Undo decrements this; redo increments it.
   * -1 means no history has been recorded (only briefly during construction).
   */
  #historyIndex = -1;

  /**
   * Private constructor — use the static factory methods `empty()` or
   * `fromRawValue()` instead. This enforces the structural invariants
   * (text boundaries, initial history snapshot) at creation time.
   */
  private constructor(segments: Segment[]) {
    this.#segments = segments;
    this.#ensureTextBoundaries();
    // Seed history with the initial state so the first mutation has
    // something to undo back to.
    this.#history = [
      { segments: this.#cloneSegments(), cursorOffset: 0, afterChiclet: false },
    ];
    this.#historyIndex = 0;
  }

  /** Number of segments in the model. */
  get length(): number {
    return this.#segments.length;
  }

  /** Return a segment by index (does not include render padding). */
  segmentAt(index: number): Segment | undefined {
    return this.#segments[index];
  }

  // ---------------------------------------------------------------------------
  // Factories
  // ---------------------------------------------------------------------------

  /** Create an empty editor model (just one empty text segment). */
  static empty(): EditorModel {
    return new EditorModel([]);
  }

  /**
   * Parse a raw template string (e.g. `"Hello {JSON} world"`) into an
   * `EditorModel`. Uses the `Template` class from `@breadboard-ai/utils`
   * for parsing the `{JSON}` placeholders.
   *
   * The parsing strategy is indirect: we use `Template.substitute()` which
   * walks the parsed parts and invokes callbacks. We intercept those
   * callbacks to build our segment array, discarding the substitution
   * output itself. This avoids duplicating the parsing logic.
   */
  static fromRawValue(raw: string): EditorModel {
    if (!raw) {
      return EditorModel.empty();
    }

    const template = new Template(raw);
    const segments: Segment[] = [];

    // Template's internal parsed format is (string | TemplatePart)[].
    // We access it indirectly: substitute() walks the parsed parts and calls
    // our callbacks — we build segments from those calls.
    template.substitute(
      (part) => {
        segments.push({ kind: "chiclet", part });
        // Return a dummy string; we only care about the walk, not the
        // rendered output.
        return "";
      },
      (str) => {
        // Strip any pre-existing ZWNBSPs from the raw string so the model
        // starts clean. ZWNBSPs are a rendering concern only.
        //
        // We always push the text segment — even when empty — so that
        // adjacent chiclets always have a cursor-landing text node between
        // them and model/render segment indices stay 1:1.
        const cleaned = str.replace(ZWNBSP_RE, "");
        segments.push({ kind: "text", text: cleaned });
        return "";
      }
    );

    return new EditorModel(segments);
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  /**
   * Serialize the model back to the raw template string format.
   *
   * This is the inverse of `fromRawValue()`. Chiclets are serialized as
   * their `{JSON}` representation via `Template.part()`. ZWNBSPs are never
   * included — they're purely a rendering concern that is added by
   * `toRenderSegments()`.
   *
   * This value is what gets stored/persisted and what the parent component
   * reads via the `value` property.
   */
  toRawValue(): string {
    let result = "";
    for (const seg of this.#segments) {
      if (seg.kind === "text") {
        result += seg.text;
      } else {
        result += Template.part(seg.part);
      }
    }
    return result;
  }

  /**
   * Produce a render-ready segment array with the ZWNBSP invariant enforced.
   *
   * ### Why ZWNBSPs?
   *
   * Browsers need a text node to place the caret in. When two chiclets are
   * adjacent, or a chiclet is at the start/end of the editor, there's no
   * text node for the caret. We inject zero-width no-break space (U+FEFF)
   * characters as invisible "cursor landing pads" to solve this:
   *
   * - Every chiclet is preceded by a text segment ending with ZWNBSP.
   * - Every chiclet is followed by a text segment starting with ZWNBSP.
   * - Adjacent chiclets share a text segment containing at least `\uFEFF\uFEFF`
   *   (one trailing for the left chiclet, one leading for the right chiclet).
   *
   * ### Why not store ZWNBSPs in the model?
   *
   * Separating the ZWNBSP concern into this render-only method keeps the
   * model's text segments clean. All offset calculations, word boundaries,
   * and serialization work on real user text without special cases.
   *
   * This is a **pure computation** — the model itself is not mutated.
   */
  toRenderSegments(): Segment[] {
    if (this.#segments.length === 0) {
      return [];
    }

    const result: Segment[] = [];

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];

      if (seg.kind === "chiclet") {
        // Ensure a text segment before the chiclet with trailing ZWNBSP.
        const prev = result[result.length - 1];
        if (!prev || prev.kind !== "text") {
          result.push({ kind: "text", text: ZWNBSP });
        } else if (!prev.text.endsWith(ZWNBSP)) {
          // Amend the existing text segment to add the landing pad.
          result[result.length - 1] = {
            kind: "text",
            text: prev.text + ZWNBSP,
          };
        }

        result.push(seg);

        // Ensure a text segment after the chiclet with leading ZWNBSP.
        // Peek ahead — if the next segment is text, we'll amend it when
        // we process it in the next iteration. If the next segment is
        // another chiclet or there is no next, insert a standalone ZWNBSP
        // text segment now.
        const next = this.#segments[i + 1];
        if (!next || next.kind === "chiclet") {
          result.push({ kind: "text", text: ZWNBSP });
        }
      } else {
        // Text segment — ensure leading ZWNBSP if preceded by a chiclet.
        const prev = result[result.length - 1];
        let text = seg.text;
        if (prev?.kind === "chiclet" && !text.startsWith(ZWNBSP)) {
          text = ZWNBSP + text;
        }
        result.push({ kind: "text", text });
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /**
   * Insert a chiclet at the given segment index. If `index` falls inside an
   * existing text segment, that segment is split.
   *
   * This is the lower-level insertion API (by segment index). The higher-level
   * `insertChicletAtOffset()` (by cursor position) is more commonly used.
   *
   * @param index Segment index at which to insert.
   * @param part The TemplatePart for the new chiclet.
   */
  insertChicletAtSegment(index: number, part: TemplatePart): void {
    const chiclet: ChicletSegment = { kind: "chiclet", part };
    const clamped = Math.max(0, Math.min(index, this.#segments.length));
    this.#segments.splice(clamped, 0, chiclet);
  }

  /**
   * Insert a chiclet at a character offset within the model's visible text.
   *
   * Because chiclets are zero-width in the visible-text coordinate system,
   * the offset refers only to text characters. When the offset lands inside
   * a text segment, that segment is **split** into before/after halves with
   * the chiclet between them.
   *
   * **Why always preserve empty text segments on split?** Even when the split
   * produces an empty string on one side (e.g. inserting at offset 0 of a
   * text segment), we keep the empty text segment. This guarantees that
   * adjacent chiclets always have a text node between them for cursor
   * placement. The invariant keeps the model/render segment indices aligned.
   *
   * @param charOffset Position in visible text (chiclets are zero-width).
   * @param part The TemplatePart for the new chiclet.
   */
  insertChicletAtOffset(charOffset: number, part: TemplatePart): void {
    let runningOffset = 0;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (seg.kind === "text") {
        const segLen = seg.text.length;
        if (runningOffset + segLen >= charOffset) {
          // Split this text segment at the offset.
          const localOffset = charOffset - runningOffset;
          const before = seg.text.slice(0, localOffset);
          const after = seg.text.slice(localOffset);

          // Always preserve text segments (even when empty) so that
          // adjacent chiclets have a cursor-landing text node between them.
          const replacement: Segment[] = [
            { kind: "text", text: before },
            { kind: "chiclet", part },
            { kind: "text", text: after },
          ];

          this.#segments.splice(i, 1, ...replacement);
          return;
        }
        runningOffset += segLen;
      }
      // Chiclets are zero-width for offset purposes — skip them.
    }

    // If we get here, offset is past the end — append.
    this.#segments.push({ kind: "chiclet", part });
  }

  /** Remove a segment by index, then merge any resulting adjacent text. */
  removeSegment(index: number): void {
    if (index < 0 || index >= this.#segments.length) {
      return;
    }

    this.#segments.splice(index, 1);
    this.#mergeAdjacentText();
  }

  /**
   * Move a chiclet from one segment index to another.
   *
   * The target index is adjusted to account for the splice: if the
   * destination was after the source, removing the source shifts all
   * subsequent indices down by one.
   *
   * @param fromIndex Source segment index (must be a chiclet).
   * @param toIndex Destination segment index (after removal).
   */
  moveChiclet(fromIndex: number, toIndex: number): void {
    const seg = this.#segments[fromIndex];
    if (!seg || seg.kind !== "chiclet") {
      return;
    }

    this.#segments.splice(fromIndex, 1);
    // Adjust target if it was after the source (indices shifted by removal).
    const adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
    const clamped = Math.max(0, Math.min(adjustedTo, this.#segments.length));
    this.#segments.splice(clamped, 0, seg);
    this.#mergeAdjacentText();
  }

  /**
   * Get the visible-text char offset where the given segment index sits.
   *
   * For chiclets, this returns the offset at the chiclet's left boundary
   * (i.e. the sum of all preceding text segment lengths). This is used
   * when recording undo snapshots for drag operations — we need to know
   * where the chiclet *was* before it moved.
   */
  chicletCharOffset(segmentIndex: number): number {
    let charRun = 0;
    for (let i = 0; i < segmentIndex && i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (seg.kind === "text") {
        charRun += seg.text.length;
      }
    }
    return charRun;
  }

  /**
   * Replace the entire text of a text segment (used when syncing from DOM
   * after user input).
   *
   * Strips any ZWNBSPs the DOM might have included, since those are a
   * render-only concern and should not leak into the model's text storage.
   */
  updateText(index: number, text: string): void {
    const seg = this.#segments[index];
    if (!seg || seg.kind !== "text") {
      return;
    }
    seg.text = text.replace(/\uFEFF/g, "");
  }

  /**
   * Find the model segment index for a chiclet by its TemplatePart
   * **reference identity** (===). Returns -1 if not found.
   *
   * This is preferred over index-based lookups when bridging between
   * render segments and model segments, because the render output may
   * contain synthetic ZWNBSP text segments that don't exist in the
   * model, making index mapping unreliable.
   */
  findSegmentByPart(part: TemplatePart): number {
    return this.#segments.findIndex(
      (s) => s.kind === "chiclet" && s.part === part
    );
  }

  /**
   * Replace the part of a chiclet segment. Used when updating step targets
   * (e.g. when the user picks a route destination from fast access).
   */
  updateChiclet(index: number, part: TemplatePart): void {
    const seg = this.#segments[index];
    if (!seg || seg.kind !== "chiclet") {
      return;
    }
    seg.part = part;
  }

  /**
   * Replace the entire model content by re-parsing a raw template string.
   *
   * @param raw The new raw template string.
   * @param resetHistory When `true` (default), history is cleared — this is
   *   the right choice for external `value` property changes (the parent
   *   component set a new value, so there's nothing to "undo" to). Pass
   *   `false` for internal operations like paste that should remain undoable.
   */
  replaceAll(raw: string, resetHistory = true): void {
    const fresh = EditorModel.fromRawValue(raw);
    this.#segments = fresh.#segments;
    if (resetHistory) {
      this.#history = [
        {
          segments: this.#cloneSegments(),
          cursorOffset: 0,
          afterChiclet: false,
        },
      ];
      this.#historyIndex = 0;
    }
  }

  /**
   * Insert plain text at a character offset (chiclets are zero-width).
   * Returns the new cursor offset after insertion.
   *
   * ### The `segmentHint` disambiguation
   *
   * When multiple zero-length text segments exist between adjacent chiclets
   * (e.g. `[chiclet][text=""][chiclet][text=""]`), they all map to the same
   * visible-text offset (0). The model can't distinguish which gap the cursor
   * is in based on offset alone.
   *
   * `segmentHint` solves this: the component layer inspects the DOM cursor
   * position to determine which model segment the caret is sitting in, and
   * passes that segment index here. If the hint matches the current segment,
   * we insert there instead of skipping past a following chiclet.
   *
   * Without this, typing between two adjacent chiclets would always insert
   * text after the second chiclet — clearly wrong from the user's perspective.
   *
   * @param charOffset Position in visible text.
   * @param text Text to insert.
   * @param segmentHint Index of the model segment the DOM cursor is in, or -1
   *   if unknown. Used to disambiguate zero-width gaps between chiclets.
   * @returns The new cursor offset after insertion.
   */
  insertTextAtOffset(
    charOffset: number,
    text: string,
    segmentHint = -1
  ): number {
    if (!text) return charOffset;

    const originalOffset = charOffset;
    let localOffset = charOffset;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (seg.kind === "text") {
        const segLen = seg.text.length;

        if (localOffset < segLen) {
          // Insert within this text segment.
          seg.text =
            seg.text.slice(0, localOffset) + text + seg.text.slice(localOffset);
          return originalOffset + text.length;
        }

        if (localOffset === segLen) {
          // At the end of this text segment. If a chiclet follows,
          // we normally skip past it so text goes after the chiclet.
          // BUT if the caller told us this exact segment is where the
          // cursor lives (segmentHint), insert here instead.
          const nextSeg = this.#segments[i + 1];
          if (nextSeg && nextSeg.kind === "chiclet" && i !== segmentHint) {
            localOffset -= segLen;
            continue;
          }
          // No chiclet follows, or this is the hinted segment — insert.
          seg.text =
            seg.text.slice(0, localOffset) + text + seg.text.slice(localOffset);
          return originalOffset + text.length;
        }

        localOffset -= segLen;
      }
    }

    // Past the end — append a new text segment.
    this.#segments.push({ kind: "text", text });
    return this.visibleTextLength;
  }

  /**
   * Delete `count` characters starting at `charOffset` in the visible text.
   * Returns the new cursor offset after deletion.
   *
   * ### Chiclet deletion semantics
   *
   * Since chiclets are zero-width, they don't occupy character positions.
   * A single Backspace or Delete at a chiclet boundary should remove the
   * chiclet rather than the adjacent text character — this feels natural
   * to the user (the chiclet is "right there" even though it's zero-width).
   *
   * For multi-character deletes (Opt+Backspace, line deletion), chiclets within
   * the range are removed using **inclusive** boundary semantics — if either
   * edge of the range touches a chiclet, it's included in the deletion.
   *
   * @param charOffset Cursor position in visible text.
   * @param count Number of characters to delete. Negative = backward
   *   (Backspace), positive = forward (Delete key).
   * @returns New cursor offset after deletion.
   */
  deleteAtOffset(charOffset: number, count: number): number {
    if (count === 0) return charOffset;

    // Check if a chiclet sits at the cursor boundary. Since chiclets are
    // zero-width, backspace/delete at a chiclet boundary should remove the
    // chiclet rather than the adjacent text.
    if (count === -1 || count === 1) {
      const chicletIndex = this.#findChicletAtBoundary(charOffset);
      if (chicletIndex !== -1) {
        this.#segments.splice(chicletIndex, 1);
        this.#mergeAdjacentText();
        return charOffset;
      }
    }

    // Backward deletion (Backspace): charOffset is cursor position, delete
    // `|count|` chars before it.
    if (count < 0) {
      const deleteCount = Math.abs(count);
      const startOffset = Math.max(0, charOffset - deleteCount);
      // Multi-char deletes use inclusive boundaries for chiclets.
      return this.#deleteRange(startOffset, charOffset, Math.abs(count) > 1);
    }

    // Forward deletion (Delete key).
    return this.#deleteRange(charOffset, charOffset + count, count > 1);
  }

  /**
   * Delete a selection range. Unlike single-char `deleteAtOffset`, this
   * always uses **inclusive** boundaries so chiclets at the edges of the
   * selection are removed. This matches user expectation: if you select
   * across a chiclet and hit Delete, the chiclet should be deleted too.
   */
  deleteSelection(startOffset: number, endOffset: number): number {
    return this.#deleteRange(startOffset, endOffset, true);
  }

  /**
   * The total visible text length (chiclets are zero-width).
   *
   * This is the length of the text the user sees and can interact with,
   * excluding chiclets. Used for forward-delete-to-end-of-line calculations
   * and cursor clamping.
   */
  get visibleTextLength(): number {
    let len = 0;
    for (const seg of this.#segments) {
      if (seg.kind === "text") {
        len += seg.text.length;
      }
    }
    return len;
  }

  /**
   * Check if a chiclet exists at the given visible-text offset boundary.
   *
   * Used by the component layer to decide whether to place the cursor
   * "after the chiclet" — because a chiclet boundary is ambiguous (the
   * cursor could logically be in the text node before or after it), the
   * component needs to know if it should bias the cursor placement.
   */
  hasChicletAtBoundary(charOffset: number): boolean {
    return this.#findChicletAtBoundary(charOffset) !== -1;
  }

  /**
   * Map a character offset in the visible text to an offset in the raw
   * template string (where chiclets are their full `{JSON}` representation).
   *
   * ### Why is `afterChiclet` needed?
   *
   * Consider: `"Hello" [chiclet] " world"`. At visible offset 5, the cursor
   * could be at the end of "Hello" (raw offset 5) or after the chiclet
   * (raw offset 5 + chiclet JSON length). The `afterChiclet` flag
   * disambiguates: when true, we skip past the chiclet's raw representation
   * to land after it.
   *
   * This is critical for paste operations, which splice text into the raw
   * string at the raw offset. Splicing at the wrong position would corrupt
   * the chiclet's JSON.
   */
  charOffsetToRawOffset(charOffset: number, afterChiclet = false): number {
    let charRun = 0;
    let rawRun = 0;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (seg.kind === "text") {
        const segEnd = charRun + seg.text.length;

        if (segEnd === charOffset && afterChiclet) {
          // At end of text segment. If a chiclet follows, skip past it
          // so the raw offset lands after the chiclet's JSON representation.
          const nextSeg = this.#segments[i + 1];
          if (nextSeg && nextSeg.kind === "chiclet") {
            charRun += seg.text.length;
            rawRun += seg.text.length;
            continue;
          }
        }

        if (segEnd >= charOffset) {
          return rawRun + (charOffset - charRun);
        }
        charRun += seg.text.length;
        rawRun += seg.text.length;
      } else {
        // Chiclet: zero-width in char space, full JSON length in raw space.
        rawRun += Template.part(seg.part).length;
      }
    }

    return rawRun;
  }

  /**
   * Find the word boundary before `charOffset` (for Opt+Backspace / word
   * deletion backward).
   *
   * Implements standard word-deletion behavior: skip trailing whitespace
   * first, then delete through the previous word. This matches what users
   * expect from Opt+Backspace in native text fields.
   */
  findWordBoundaryBefore(charOffset: number): number {
    const text = this.#visibleTextUpTo(charOffset);
    let pos = text.length;

    // Skip whitespace (e.g. "hello world|" → skip the space).
    while (pos > 0 && /\s/.test(text[pos - 1])) pos--;
    // Skip word characters (e.g. "hello|" → skip "hello").
    while (pos > 0 && /\S/.test(text[pos - 1])) pos--;

    return charOffset - (text.length - pos);
  }

  /**
   * Find the word boundary after `charOffset` (for Opt+Delete / word
   * deletion forward).
   *
   * Mirrors `findWordBoundaryBefore` but in the forward direction: skip
   * word characters first, then trailing whitespace.
   */
  findWordBoundaryAfter(charOffset: number): number {
    const fullText = this.#fullVisibleText();
    let pos = charOffset;

    // Skip word characters.
    while (pos < fullText.length && /\S/.test(fullText[pos])) pos++;
    // Skip whitespace.
    while (pos < fullText.length && /\s/.test(fullText[pos])) pos++;

    return pos;
  }

  /**
   * Extract the raw template string between two visible-text offsets.
   *
   * Chiclets within the range are included as their `{JSON}` representation so
   * that copy/cut operations preserve chiclet syntax on the clipboard. When
   * pasted back, the raw string is re-parsed and chiclets are reconstituted.
   *
   * @param startOff Start of range in visible-text coordinates.
   * @param endOff End of range in visible-text coordinates.
   * @returns Raw template string for the selected range.
   */
  rawSlice(startOff: number, endOff: number): string {
    let result = "";
    let charRun = 0;

    for (const seg of this.#segments) {
      if (seg.kind === "text") {
        const segStart = charRun;
        const segEnd = charRun + seg.text.length;
        if (segEnd > startOff && segStart < endOff) {
          const localStart = Math.max(0, startOff - segStart);
          const localEnd = Math.min(seg.text.length, endOff - segStart);
          result += seg.text.slice(localStart, localEnd);
        }
        charRun += seg.text.length;
      } else {
        // Include chiclet if it falls within the selection range.
        if (charRun >= startOff && charRun <= endOff) {
          result += Template.part(seg.part);
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Find a chiclet segment that sits at exactly `charOffset` in the
   * visible text. Returns the segment index, or -1 if none found.
   *
   * Because chiclets are zero-width, a chiclet "sits at" an offset when
   * the sum of all preceding text segment lengths equals that offset.
   * This is used by single-character deletion to detect "should I delete
   * this chiclet?" before falling through to text deletion logic.
   */
  #findChicletAtBoundary(charOffset: number): number {
    let runningOffset = 0;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (seg.kind === "chiclet") {
        if (runningOffset === charOffset) {
          return i;
        }
      } else {
        runningOffset += seg.text.length;
      }
    }

    return -1;
  }

  /**
   * Delete visible characters between `startOff` and `endOff`.
   *
   * ### Inclusive vs exclusive chiclet boundaries
   *
   * The `inclusive` flag controls how chiclets at the range boundaries are
   * treated:
   *
   * - **Exclusive** (`inclusive=false`): only chiclets strictly *inside* the
   *   range are removed. Used for single-character deletes where the chiclet
   *   at the boundary should be preserved (single-char chiclet deletion is
   *   handled separately by `#findChicletAtBoundary`).
   *
   * - **Inclusive** (`inclusive=true`): chiclets at *either boundary* are also
   *   removed. Used for selection deletes and multi-character word/line
   *   deletes, where the user clearly intends to delete everything in the
   *   range.
   *
   * @returns `startOff` as the new cursor position (cursor stays at the
   *   beginning of the deleted range).
   */
  #deleteRange(startOff: number, endOff: number, inclusive = false): number {
    if (startOff >= endOff) return startOff;

    let runningOffset = 0;
    let remaining = endOff - startOff;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];

      if (seg.kind === "chiclet") {
        // Determine if this chiclet falls within the deletion range.
        const inRange = inclusive
          ? runningOffset >= startOff && runningOffset <= endOff
          : runningOffset > startOff && runningOffset < endOff;
        if (inRange) {
          this.#segments.splice(i, 1);
          i--; // Re-examine this index after removal.
        }
        continue;
      }

      // Text processing — skip if all visible chars have been deleted.
      if (remaining <= 0) continue;

      const segLen = seg.text.length;
      const segEnd = runningOffset + segLen;

      if (segEnd <= startOff) {
        // This segment is entirely before the deletion range — skip it.
        runningOffset = segEnd;
        continue;
      }

      // Compute the overlap between this text segment and the deletion range.
      const localStart = Math.max(0, startOff - runningOffset);
      const localEnd = Math.min(segLen, endOff - runningOffset);
      const deleteCount = localEnd - localStart;

      if (deleteCount >= segLen) {
        // Entire segment is within the deletion range — remove it.
        this.#segments.splice(i, 1);
        i--; // Re-examine this index after removal.
      } else {
        // Partial deletion — splice out the deleted range from the text.
        seg.text = seg.text.slice(0, localStart) + seg.text.slice(localEnd);
      }

      remaining -= deleteCount;
      runningOffset = segEnd - deleteCount;
    }

    this.#mergeAdjacentText();
    return startOff;
  }

  /**
   * Merge adjacent text segments after a structural mutation.
   *
   * When a chiclet is removed, the text segments that were on either side
   * of it become neighbors. This method collapses them into a single text
   * segment, maintaining the "no adjacent text segments" invariant.
   *
   * Also re-establishes the text-boundary invariant via `#ensureTextBoundaries()`.
   */
  #mergeAdjacentText(): void {
    const merged: Segment[] = [];
    for (const seg of this.#segments) {
      const prev = merged[merged.length - 1];
      if (seg.kind === "text" && prev?.kind === "text") {
        merged[merged.length - 1] = {
          kind: "text",
          text: prev.text + seg.text,
        };
      } else {
        merged.push(seg);
      }
    }
    this.#segments = merged;
    this.#ensureTextBoundaries();
  }

  /**
   * Ensure the segment array starts and ends with a text segment.
   *
   * This invariant guarantees that:
   * - `insertChicletAtOffset(0)` always has a text segment to split before
   *   the first chiclet (without this, the offset-walking loop would find no
   *   text segment and fall through to the append path, placing the chiclet
   *   at the end instead of the beginning).
   * - `toRenderSegments()` never needs to synthesize text segments that
   *   don't exist in the model, keeping render and model indices 1:1.
   */
  #ensureTextBoundaries(): void {
    if (this.#segments.length === 0 || this.#segments[0].kind !== "text") {
      this.#segments.unshift({ kind: "text", text: "" });
    }
    if (this.#segments[this.#segments.length - 1].kind !== "text") {
      this.#segments.push({ kind: "text", text: "" });
    }
  }

  /**
   * Concatenate visible text (no chiclets, no ZWNBSPs) up to `charOffset`.
   * Used by `findWordBoundaryBefore()` to scan backward from the cursor.
   */
  #visibleTextUpTo(charOffset: number): string {
    let result = "";
    let remaining = charOffset;
    for (const seg of this.#segments) {
      if (seg.kind === "text") {
        const take = Math.min(seg.text.length, remaining);
        result += seg.text.slice(0, take);
        remaining -= take;
        if (remaining <= 0) break;
      }
    }
    return result;
  }

  /**
   * Concatenate all visible text (no chiclets, no ZWNBSPs).
   * Used by `findWordBoundaryAfter()` to scan forward from the cursor.
   */
  #fullVisibleText(): string {
    return this.#segments
      .filter((s): s is TextSegment => s.kind === "text")
      .map((s) => s.text)
      .join("");
  }

  // ---------------------------------------------------------------------------
  // History (undo / redo)
  // ---------------------------------------------------------------------------

  /**
   * Deep-clone the current segments array.
   *
   * Each snapshot must own an independent copy of the segments (and their
   * TemplatePart objects) so later mutations don't corrupt earlier history.
   * We shallow-clone each TemplatePart with spread — sufficient because
   * TemplateParts are flat objects with primitive values.
   */
  #cloneSegments(): Segment[] {
    return this.#segments.map((s) =>
      s.kind === "text"
        ? { kind: "text" as const, text: s.text }
        : { kind: "chiclet" as const, part: { ...s.part } }
    );
  }

  /**
   * Record a snapshot of the current model state after a mutation.
   * Convenience wrapper that captures and pushes in one call.
   *
   * Discards any redo entries when called after an undo — this implements
   * the standard "branching" undo behavior where a new mutation after an
   * undo discards the undone future.
   */
  pushSnapshot(cursorOffset: number, afterChiclet = false): void {
    this.pushPreparedSnapshot(this.captureSnapshot(cursorOffset, afterChiclet));
  }

  /**
   * Eagerly capture a snapshot of the current model state **without** pushing
   * it to history.
   *
   * This is the first half of the debounced typing workflow: the component
   * captures the snapshot at keystroke time (so it reflects the state *after*
   * the keystroke), then pushes it to history after a 300ms typing pause.
   * This ensures the snapshot's segments reflect the correct point in time
   * even though the push is delayed.
   */
  captureSnapshot(cursorOffset: number, afterChiclet = false): Snapshot {
    return {
      segments: this.#cloneSegments(),
      cursorOffset,
      afterChiclet,
    };
  }

  /**
   * Push a previously captured snapshot to history.
   *
   * Discards any redo entries (standard branching undo behavior) and
   * enforces the ring buffer limit by shifting out the oldest entry
   * when the history exceeds `MAX_HISTORY`.
   */
  pushPreparedSnapshot(snapshot: Snapshot): void {
    // Discard redo stack: any snapshots after the current index are
    // from undone work that's now being overwritten by new mutations.
    this.#history.length = this.#historyIndex + 1;

    this.#history.push(snapshot);

    // Enforce ring buffer limit to bound memory usage.
    if (this.#history.length > MAX_HISTORY) {
      this.#history.shift();
    }

    this.#historyIndex = this.#history.length - 1;
  }

  /** Current position in the history stack (for anchoring fast access). */
  get historyIndex(): number {
    return this.#historyIndex;
  }

  /**
   * Truncate history back to a saved index, discarding all snapshots after it.
   *
   * This does NOT restore model segments — used when the current model state
   * is already correct but we need to rewind the history pointer. The primary
   * use case is chiclet insertion after '@' trigger: the '@' character was
   * typed (creating a snapshot), but when the user picks a chiclet from fast
   * access, we want undo to skip past the '@' state entirely, jumping from
   * "pre-@" to "with-chiclet".
   */
  truncateHistoryTo(index: number): void {
    if (index < 0 || index >= this.#history.length) return;
    this.#historyIndex = index;
    this.#history.length = index + 1;
  }

  /**
   * Undo: restore the previous snapshot.
   *
   * Returns the cursor position metadata from the restored snapshot so the
   * component can place the caret in the right position. Returns `null` if
   * there's nothing left to undo (already at the initial state).
   *
   * The segments are deep-cloned from the snapshot to prevent the restored
   * state from sharing references with the history entry.
   */
  undo(): { cursorOffset: number; afterChiclet: boolean } | null {
    if (this.#historyIndex <= 0) return null;

    this.#historyIndex--;
    const snapshot = this.#history[this.#historyIndex];
    this.#segments = snapshot.segments.map((s) =>
      s.kind === "text"
        ? { kind: "text" as const, text: s.text }
        : { kind: "chiclet" as const, part: { ...s.part } }
    );
    return {
      cursorOffset: snapshot.cursorOffset,
      afterChiclet: snapshot.afterChiclet,
    };
  }

  /**
   * Redo: restore the next snapshot (after an undo).
   *
   * Returns cursor position metadata, or `null` if there's nothing to redo
   * (already at the latest state). Same deep-cloning strategy as `undo()`.
   */
  redo(): { cursorOffset: number; afterChiclet: boolean } | null {
    if (this.#historyIndex >= this.#history.length - 1) return null;

    this.#historyIndex++;
    const snapshot = this.#history[this.#historyIndex];
    this.#segments = snapshot.segments.map((s) =>
      s.kind === "text"
        ? { kind: "text" as const, text: s.text }
        : { kind: "chiclet" as const, part: { ...s.part } }
    );
    return {
      cursorOffset: snapshot.cursorOffset,
      afterChiclet: snapshot.afterChiclet,
    };
  }
}
