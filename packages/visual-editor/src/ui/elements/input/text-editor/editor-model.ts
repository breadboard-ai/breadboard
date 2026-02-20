/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Template, TemplatePart } from "@breadboard-ai/utils";
import { ZWNBSP, ZWNBSP_RE } from "./constants.js";

export { EditorModel };
export type { TextSegment, ChicletSegment, Segment, Snapshot };

interface TextSegment {
  kind: "text";
  text: string;
}

interface ChicletSegment {
  kind: "chiclet";
  part: TemplatePart;
}

type Segment = TextSegment | ChicletSegment;

interface Snapshot {
  segments: Segment[];
  cursorOffset: number;
  afterChiclet: boolean;
}

const MAX_HISTORY = 50;

/**
 * Pure data model for the text editor's content.
 *
 * Content is an ordered array of `Segment` values — either plain text or
 * chiclets (template parts). The model guarantees structural invariants
 * (e.g. ZWNBSP padding around chiclets) when producing the render-ready view.
 */
class EditorModel {
  #segments: Segment[];
  #history: Snapshot[] = [];
  #historyIndex = -1;

  private constructor(segments: Segment[]) {
    this.#segments = segments;
    this.#ensureTextBoundaries();
    // Seed history with the initial state.
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

  static empty(): EditorModel {
    return new EditorModel([]);
  }

  /**
   * Parse a raw template string (e.g. `"Hello {JSON} world"`) into an
   * `EditorModel`. Uses the `Template` class from `@breadboard-ai/utils`
   * for parsing the `{JSON}` placeholders.
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
        // starts clean. Always push the text segment — even when empty — so
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
   * ZWNBSPs are never included — they're purely a rendering concern.
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
   * Produce a render-ready segment array with the ZWNBSP invariant enforced:
   *
   * - Every chiclet is preceded by a text segment ending with ZWNBSP.
   * - Every chiclet is followed by a text segment starting with ZWNBSP.
   * - Adjacent chiclets share a text segment containing at least `\uFEFF\uFEFF`
   *   (one trailing for the left chiclet, one leading for the right chiclet).
   *
   * This is a pure computation — the model itself is not mutated.
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
          // Amend the existing text segment.
          result[result.length - 1] = {
            kind: "text",
            text: prev.text + ZWNBSP,
          };
        }

        result.push(seg);

        // Ensure a text segment after the chiclet with leading ZWNBSP.
        // Peek ahead — if the next segment is text, we'll amend it when
        // we process it. If the next segment is another chiclet or
        // there is no next, insert a standalone ZWNBSP text segment now.
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
   * @param index Segment index at which to insert.
   * @param part The TemplatePart for the new chiclet.
   */
  insertChicletAtSegment(index: number, part: TemplatePart): void {
    const chiclet: ChicletSegment = { kind: "chiclet", part };
    const clamped = Math.max(0, Math.min(index, this.#segments.length));
    this.#segments.splice(clamped, 0, chiclet);
  }

  /**
   * Insert a chiclet at a character offset within the model's raw text
   * (ignoring chiclets — each chiclet counts as 0 characters for this
   * purpose). This is the method used when inserting from a cursor position.
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
      // Chiclets are zero-width for offset purposes.
    }

    // If we get here, offset is past the end — append.
    this.#segments.push({ kind: "chiclet", part });
  }

  /** Remove a segment by index. */
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
   * @param fromIndex Source segment index (must be a chiclet).
   * @param toIndex Destination segment index (after removal).
   */
  moveChiclet(fromIndex: number, toIndex: number): void {
    const seg = this.#segments[fromIndex];
    if (!seg || seg.kind !== "chiclet") {
      return;
    }

    this.#segments.splice(fromIndex, 1);
    // Adjust target if it was after the source.
    const adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
    const clamped = Math.max(0, Math.min(adjustedTo, this.#segments.length));
    this.#segments.splice(clamped, 0, seg);
    this.#mergeAdjacentText();
  }

  /**
   * Get the visible-text char offset where the given segment index sits.
   * For chiclets, this is the offset at the chiclet boundary.
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
   */
  updateText(index: number, text: string): void {
    const seg = this.#segments[index];
    if (!seg || seg.kind !== "text") {
      return;
    }
    // Strip any ZWNBSPs the DOM might have included.
    seg.text = text.replace(/\uFEFF/g, "");
  }

  /**
   * Find the model segment index for a chiclet by its TemplatePart reference.
   * Returns -1 if not found.
   */
  findSegmentByPart(part: TemplatePart): number {
    return this.#segments.findIndex(
      (s) => s.kind === "chiclet" && s.part === part
    );
  }

  /**
   * Replace the part of a chiclet segment. Used when updating step targets.
   */
  updateChiclet(index: number, part: TemplatePart): void {
    const seg = this.#segments[index];
    if (!seg || seg.kind !== "chiclet") {
      return;
    }
    seg.part = part;
  }

  /**
   * Replace the entire model content.
   *
   * When `resetHistory` is true (the default), history is cleared — used
   * for external `value` property changes. Pass `false` for internal
   * operations like paste that should be undoable.
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
   * When `segmentHint` is ≥ 0 it identifies the model segment the DOM
   * cursor is sitting in.  This disambiguates positions that share the
   * same visible-text offset (e.g. the text nodes between adjacent
   * chiclets are all zero-width, so every gap maps to the same offset).
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
   * Delete `count` characters starting at `charOffset` in the visible text
   * (chiclets are zero-width). If a deletion reaches a chiclet, the chiclet
   * is removed. Returns the new cursor offset after deletion.
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
   * Delete a selection range. Unlike single-char `deleteAtOffset`, this uses
   * inclusive boundaries so chiclets at the start of the selection are removed.
   */
  deleteSelection(startOffset: number, endOffset: number): number {
    return this.#deleteRange(startOffset, endOffset, true);
  }

  /**
   * The total visible text length (chiclets are zero-width).
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
   */
  hasChicletAtBoundary(charOffset: number): boolean {
    return this.#findChicletAtBoundary(charOffset) !== -1;
  }

  /**
   * Map a character offset in the visible text to an offset in the raw
   * template string (where chiclets are their full `{JSON}` representation).
   */
  charOffsetToRawOffset(charOffset: number, afterChiclet = false): number {
    let charRun = 0;
    let rawRun = 0;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];
      if (seg.kind === "text") {
        const segEnd = charRun + seg.text.length;

        if (segEnd === charOffset && afterChiclet) {
          // At end of text segment. If a chiclet follows, skip past it.
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
        rawRun += Template.part(seg.part).length;
      }
    }

    return rawRun;
  }

  /**
   * Find the word boundary before `charOffset` (for Opt+Backspace).
   * Skips trailing whitespace, then deletes through the previous word.
   */
  findWordBoundaryBefore(charOffset: number): number {
    const text = this.#visibleTextUpTo(charOffset);
    let pos = text.length;

    // Skip whitespace.
    while (pos > 0 && /\s/.test(text[pos - 1])) pos--;
    // Skip word characters.
    while (pos > 0 && /\S/.test(text[pos - 1])) pos--;

    return charOffset - (text.length - pos);
  }

  /**
   * Find the word boundary after `charOffset` (for Opt+Delete).
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
   * Chiclets within the range are included as their `{JSON}` representation.
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
   * If the range boundary lands exactly at a chiclet, the chiclet is removed.
   * Returns `startOff` as the new cursor position.
   */
  #deleteRange(startOff: number, endOff: number, inclusive = false): number {
    if (startOff >= endOff) return startOff;

    let runningOffset = 0;
    let remaining = endOff - startOff;

    for (let i = 0; i < this.#segments.length; i++) {
      const seg = this.#segments[i];

      if (seg.kind === "chiclet") {
        // For single-char deletes (inclusive=false), only remove chiclets
        // strictly inside the range. For selection deletes (inclusive=true),
        // also remove chiclets at both boundaries.
        const inRange = inclusive
          ? runningOffset >= startOff && runningOffset <= endOff
          : runningOffset > startOff && runningOffset < endOff;
        if (inRange) {
          this.#segments.splice(i, 1);
          i--;
        }
        continue;
      }

      // Text processing — skip if all visible chars have been deleted.
      if (remaining <= 0) continue;

      const segLen = seg.text.length;
      const segEnd = runningOffset + segLen;

      if (segEnd <= startOff) {
        // This segment is entirely before the deletion range.
        runningOffset = segEnd;
        continue;
      }

      // Compute the overlap within this text segment.
      const localStart = Math.max(0, startOff - runningOffset);
      const localEnd = Math.min(segLen, endOff - runningOffset);
      const deleteCount = localEnd - localStart;

      if (deleteCount >= segLen) {
        // Entire segment is within the deletion range.
        this.#segments.splice(i, 1);
        i--;
      } else {
        seg.text = seg.text.slice(0, localStart) + seg.text.slice(localEnd);
      }

      remaining -= deleteCount;
      runningOffset = segEnd - deleteCount;
    }

    this.#mergeAdjacentText();
    return startOff;
  }

  /** Merge adjacent text segments after a structural mutation. */
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
   *   the first chiclet.
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

  /** Concatenate visible text (no chiclets, no ZWNBSPs) up to `charOffset`. */
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

  /** Concatenate all visible text (no chiclets, no ZWNBSPs). */
  #fullVisibleText(): string {
    return this.#segments
      .filter((s): s is TextSegment => s.kind === "text")
      .map((s) => s.text)
      .join("");
  }

  // ---------------------------------------------------------------------------
  // History (undo / redo)
  // ---------------------------------------------------------------------------

  /** Deep-clone the current segments array. */
  #cloneSegments(): Segment[] {
    return this.#segments.map((s) =>
      s.kind === "text"
        ? { kind: "text" as const, text: s.text }
        : { kind: "chiclet" as const, part: { ...s.part } }
    );
  }

  /**
   * Record a snapshot of the current model state after a mutation.
   * Discards any redo entries when called after an undo.
   */
  pushSnapshot(cursorOffset: number, afterChiclet = false): void {
    this.pushPreparedSnapshot(this.captureSnapshot(cursorOffset, afterChiclet));
  }

  /**
   * Eagerly capture a snapshot of the current model state without pushing
   * it to history. Used with debounced typing to clone state at keystroke
   * time and push later.
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
   * Discards any redo entries.
   */
  pushPreparedSnapshot(snapshot: Snapshot): void {
    // Discard redo stack.
    this.#history.length = this.#historyIndex + 1;

    this.#history.push(snapshot);

    // Enforce ring buffer limit.
    if (this.#history.length > MAX_HISTORY) {
      this.#history.shift();
    }

    this.#historyIndex = this.#history.length - 1;
  }

  /** Current position in the history stack. */
  get historyIndex(): number {
    return this.#historyIndex;
  }

  /**
   * Truncate history back to a saved index, discarding all snapshots after it.
   * Does NOT restore model segments — used when the current model state is
   * already correct (e.g., chiclet insertion after '@' trigger).
   */
  truncateHistoryTo(index: number): void {
    if (index < 0 || index >= this.#history.length) return;
    this.#historyIndex = index;
    this.#history.length = index + 1;
  }

  /**
   * Restore the previous snapshot. Returns `{ cursorOffset, afterChiclet }`
   * from the restored snapshot, or `null` if there's nothing to undo.
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
   * Restore the next snapshot (after an undo). Returns cursor info or `null`.
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
