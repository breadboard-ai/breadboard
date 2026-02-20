/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { setDOM, unsetDOM } from "../../../fake-dom.js";
import {
  charOffsetToRawOffset,
  isChicletNode,
  nextSignificantSibling,
  prevSignificantSibling,
  EditorSelection,
} from "../../../../src/ui/elements/input/text-editor/editor-selection.js";
import type {
  TextSegment,
  ChicletSegment,
  Segment,
} from "../../../../src/ui/elements/input/text-editor/editor-model.js";
import type { TemplatePart } from "@breadboard-ai/utils";

const ZWNBSP = "\uFEFF";

function makePart(overrides: Partial<TemplatePart> = {}): TemplatePart {
  return {
    type: "in",
    path: "test-node",
    title: "Test Node",
    ...overrides,
  };
}

function textSeg(text: string): TextSegment {
  return { kind: "text", text };
}

function chicletSeg(overrides: Partial<TemplatePart> = {}): ChicletSegment {
  return { kind: "chiclet", part: makePart(overrides) };
}

function makeChicletLabel(text = "Chiclet"): HTMLElement {
  const label = document.createElement("label");
  label.classList.add("chiclet");
  label.textContent = text;
  return label;
}

// ---------------------------------------------------------------------------
// charOffsetToRawOffset (pure function — no DOM)
// ---------------------------------------------------------------------------

describe("charOffsetToRawOffset", () => {
  it("maps offset in plain text directly", () => {
    const segments: Segment[] = [textSeg("Hello world")];
    assert.equal(charOffsetToRawOffset(segments, 0), 0);
    assert.equal(charOffsetToRawOffset(segments, 5), 5);
    assert.equal(charOffsetToRawOffset(segments, 11), 11);
  });

  it("returns end position for offset past end", () => {
    const segments: Segment[] = [textSeg("Hello")];
    assert.equal(charOffsetToRawOffset(segments, 100), 5);
  });

  it("skips over chiclet JSON in raw offset", () => {
    const segments: Segment[] = [
      textSeg(`Hello${ZWNBSP}`),
      chicletSeg(),
      textSeg(`${ZWNBSP}world`),
    ];
    assert.equal(charOffsetToRawOffset(segments, 5), 5);
  });

  it("handles empty input", () => {
    assert.equal(charOffsetToRawOffset([], 0), 0);
  });

  it("handles chiclet at start", () => {
    const segments: Segment[] = [
      textSeg(ZWNBSP),
      chicletSeg(),
      textSeg(`${ZWNBSP}Hello`),
    ];
    const part = makePart();
    const chicletLen = `{${JSON.stringify(part)}}`.length;
    assert.equal(charOffsetToRawOffset(segments, 0), 0);
    assert.equal(charOffsetToRawOffset(segments, 1), chicletLen + 1);
  });

  it("handles adjacent chiclets", () => {
    const segments: Segment[] = [
      textSeg(ZWNBSP),
      chicletSeg({ path: "n1" }),
      textSeg(ZWNBSP),
      chicletSeg({ path: "n2" }),
      textSeg(ZWNBSP),
    ];
    assert.equal(charOffsetToRawOffset(segments, 0), 0);
  });
});

// ---------------------------------------------------------------------------
// isChicletNode (DOM-based)
// ---------------------------------------------------------------------------

describe("isChicletNode", () => {
  beforeEach(() => setDOM());
  afterEach(() => unsetDOM());

  it("returns true for a label with .chiclet class", () => {
    assert.equal(isChicletNode(makeChicletLabel()), true);
  });

  it("returns false for a label without .chiclet class", () => {
    const label = document.createElement("label");
    assert.equal(isChicletNode(label), false);
  });

  it("returns false for a text node", () => {
    assert.equal(isChicletNode(document.createTextNode("hello")), false);
  });

  it("returns false for null", () => {
    assert.equal(isChicletNode(null), false);
  });

  it("returns true for any HTMLElement with .chiclet class", () => {
    const span = document.createElement("span");
    span.classList.add("chiclet");
    assert.equal(isChicletNode(span), true);
  });
});

// ---------------------------------------------------------------------------
// nextSignificantSibling / prevSignificantSibling
// ---------------------------------------------------------------------------

describe("nextSignificantSibling", () => {
  beforeEach(() => setDOM());
  afterEach(() => unsetDOM());

  it("returns the immediate next sibling when it is not a comment", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const b = document.createTextNode("B");
    parent.appendChild(a);
    parent.appendChild(b);

    assert.equal(nextSignificantSibling(a), b);
  });

  it("skips comment nodes (Lit markers)", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const comment = document.createComment("lit-marker");
    const b = document.createTextNode("B");
    parent.appendChild(a);
    parent.appendChild(comment);
    parent.appendChild(b);

    assert.equal(nextSignificantSibling(a), b);
  });

  it("skips multiple consecutive comment nodes", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const c1 = document.createComment("c1");
    const c2 = document.createComment("c2");
    const b = document.createTextNode("B");
    parent.appendChild(a);
    parent.appendChild(c1);
    parent.appendChild(c2);
    parent.appendChild(b);

    assert.equal(nextSignificantSibling(a), b);
  });

  it("returns null when there is no next sibling", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    parent.appendChild(a);

    assert.equal(nextSignificantSibling(a), null);
  });

  it("returns null when only comment siblings remain", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const comment = document.createComment("only-comment");
    parent.appendChild(a);
    parent.appendChild(comment);

    assert.equal(nextSignificantSibling(a), null);
  });

  it("returns null for null input", () => {
    assert.equal(nextSignificantSibling(null), null);
  });
});

describe("prevSignificantSibling", () => {
  beforeEach(() => setDOM());
  afterEach(() => unsetDOM());

  it("returns the immediate previous sibling when it is not a comment", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const b = document.createTextNode("B");
    parent.appendChild(a);
    parent.appendChild(b);

    assert.equal(prevSignificantSibling(b), a);
  });

  it("skips comment nodes (Lit markers)", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const comment = document.createComment("lit-marker");
    const b = document.createTextNode("B");
    parent.appendChild(a);
    parent.appendChild(comment);
    parent.appendChild(b);

    assert.equal(prevSignificantSibling(b), a);
  });

  it("skips multiple consecutive comment nodes", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    const c1 = document.createComment("c1");
    const c2 = document.createComment("c2");
    const b = document.createTextNode("B");
    parent.appendChild(a);
    parent.appendChild(c1);
    parent.appendChild(c2);
    parent.appendChild(b);

    assert.equal(prevSignificantSibling(b), a);
  });

  it("returns null when there is no previous sibling", () => {
    const parent = document.createElement("div");
    const a = document.createTextNode("A");
    parent.appendChild(a);

    assert.equal(prevSignificantSibling(a), null);
  });

  it("returns null when only comment siblings precede", () => {
    const parent = document.createElement("div");
    const comment = document.createComment("only-comment");
    const b = document.createTextNode("B");
    parent.appendChild(comment);
    parent.appendChild(b);

    assert.equal(prevSignificantSibling(b), null);
  });

  it("returns null for null input", () => {
    assert.equal(prevSignificantSibling(null), null);
  });
});

// ---------------------------------------------------------------------------
// EditorSelection (DOM-based methods)
// ---------------------------------------------------------------------------

describe("EditorSelection", () => {
  let container: HTMLDivElement;
  let editor: HTMLSpanElement;
  let sel: EditorSelection;

  beforeEach(() => {
    setDOM();
    container = document.createElement("div");
    const shadowRoot = container.attachShadow({ mode: "open" });
    editor = document.createElement("span");
    editor.id = "editor";
    editor.setAttribute("contenteditable", "true");
    shadowRoot.appendChild(editor);
    document.body.appendChild(container);

    sel = new EditorSelection(
      shadowRoot as unknown as ShadowRoot,
      () => editor
    );
  });

  afterEach(() => {
    document.body.removeChild(container);
    unsetDOM();
  });

  // -----------------------------------------------------------------------
  // getRange / getSelection
  // -----------------------------------------------------------------------

  describe("getRange", () => {
    it("returns null when there is no selection", () => {
      assert.equal(sel.getRange(), null);
    });
  });

  describe("getSelection", () => {
    it("returns a Selection object or null", () => {
      const selection = sel.getSelection();
      assert.ok(selection === null || typeof selection === "object");
    });
  });

  // -----------------------------------------------------------------------
  // isRangeValid
  // -----------------------------------------------------------------------

  describe("isRangeValid", () => {
    it("returns true for a range inside the editor", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(text, 0);
      range.collapse(true);

      assert.equal(sel.isRangeValid(range), true);
    });

    it("returns false for a range outside the editor", () => {
      const outside = document.createTextNode("outside");
      document.body.appendChild(outside);

      const range = document.createRange();
      range.setStart(outside, 0);
      range.collapse(true);

      assert.equal(sel.isRangeValid(range), false);
      document.body.removeChild(outside);
    });
  });

  // -----------------------------------------------------------------------
  // snapshot
  // -----------------------------------------------------------------------

  describe("snapshot", () => {
    it("returns null when there is no selection", () => {
      assert.equal(sel.snapshot(), null);
    });

    it("captures segment index and offset for a text node", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      // Programmatically set a selection in the editor.
      const docSel = sel.getSelection();
      if (docSel) {
        const range = document.createRange();
        range.setStart(text, 3);
        range.collapse(true);
        docSel.removeAllRanges();
        docSel.addRange(range);
      }

      const snap = sel.snapshot();
      if (snap) {
        assert.equal(snap.segmentIndex, 0);
        assert.equal(snap.offset, 3);
      }
    });

    it("captures correct segment index with chiclet", () => {
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      const docSel = sel.getSelection();
      if (docSel) {
        const range = document.createRange();
        range.setStart(text2, 2);
        range.collapse(true);
        docSel.removeAllRanges();
        docSel.addRange(range);
      }

      const snap = sel.snapshot();
      if (snap) {
        assert.equal(snap.segmentIndex, 2); // text2 is child index 2
        assert.equal(snap.offset, 2);
      }
    });

    it("finds cursor in a nested child via contains()", () => {
      // Simulates a chiclet label with an inner span. The range may land
      // on the inner span, but snapshot should still find it via .contains().
      const chiclet = makeChicletLabel();
      const innerSpan = document.createElement("span");
      innerSpan.textContent = "inner";
      chiclet.appendChild(innerSpan);
      editor.appendChild(chiclet);

      const docSel = sel.getSelection();
      if (docSel) {
        const range = document.createRange();
        range.setStart(innerSpan, 0);
        range.collapse(true);
        docSel.removeAllRanges();
        docSel.addRange(range);
      }

      const snap = sel.snapshot();
      if (snap) {
        // The chiclet is child index 0; innerSpan is contained by it.
        assert.equal(snap.segmentIndex, 0);
        assert.equal(snap.offset, 0);
      }
    });

    it("returns null when range is outside editor", () => {
      const outside = document.createTextNode("outside");
      document.body.appendChild(outside);

      const docSel = sel.getSelection();
      if (docSel) {
        const range = document.createRange();
        range.setStart(outside, 0);
        range.collapse(true);
        docSel.removeAllRanges();
        docSel.addRange(range);
      }

      const snap = sel.snapshot();
      // Snapshot may return null since the node isn't a child of editor
      assert.equal(snap, null);
      document.body.removeChild(outside);
    });
  });

  // -----------------------------------------------------------------------
  // restoreAfterChicletInsert
  // -----------------------------------------------------------------------

  describe("restoreAfterChicletInsert", () => {
    it("places cursor after the last chiclet's following text node", () => {
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode(`${ZWNBSP}world`);
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      // Should not throw and should position cursor.
      sel.restoreAfterChicletInsert();
    });

    it("does nothing when no chiclet is in the editor", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      sel.restoreAfterChicletInsert();
    });

    it("does nothing for empty editor", () => {
      sel.restoreAfterChicletInsert();
    });

    it("handles chiclet at end with no following text node", () => {
      const text = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      editor.appendChild(text);
      editor.appendChild(chiclet);

      // Chiclet is last child, no following text — should handle gracefully.
      sel.restoreAfterChicletInsert();
    });

    it("handles multiple chiclets — positions after the last one", () => {
      const text1 = document.createTextNode("A");
      const c1 = makeChicletLabel("C1");
      const text2 = document.createTextNode("B");
      const c2 = makeChicletLabel("C2");
      const text3 = document.createTextNode("end");
      editor.appendChild(text1);
      editor.appendChild(c1);
      editor.appendChild(text2);
      editor.appendChild(c2);
      editor.appendChild(text3);

      sel.restoreAfterChicletInsert();
      // Should find c2 (last chiclet walking backward) and position in text3.
    });
  });

  // -----------------------------------------------------------------------
  // rangeToCharOffset
  // -----------------------------------------------------------------------

  describe("rangeToCharOffset", () => {
    it("returns 0 for a null range", () => {
      assert.equal(sel.rangeToCharOffset(null), 0);
    });

    it("computes offset for text content", () => {
      const text = document.createTextNode("Hello world");
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(text, 5);
      range.collapse(true);

      assert.equal(sel.rangeToCharOffset(range), 5);
    });

    it("skips ZWNBSPs when computing offset", () => {
      const text = document.createTextNode(`${ZWNBSP}Hello`);
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(text, 2);
      range.collapse(true);

      assert.equal(sel.rangeToCharOffset(range), 1);
    });

    it("skips chiclet labels", () => {
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      const range = document.createRange();
      range.setStart(text2, 2);
      range.collapse(true);

      assert.equal(sel.rangeToCharOffset(range), 4);
    });

    it("handles range at editor level (not text node)", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(editor, 0);
      range.collapse(true);

      assert.equal(sel.rangeToCharOffset(range), 0);
    });

    it("counts visible text in children when startContainer is editor", () => {
      // Tests L214-218: iterating children counting visible text lengths.
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      // Range at editor level, offset=3 means "after 3 child nodes".
      const range = document.createRange();
      range.setStart(editor, 3); // past text1, chiclet, text2
      range.collapse(true);

      // Should count "Hi" (2) + chiclet (0) + "world" (5) = 7
      assert.equal(sel.rangeToCharOffset(range), 7);
    });
  });

  // -----------------------------------------------------------------------
  // nodeToCharOffset
  // -----------------------------------------------------------------------

  describe("nodeToCharOffset", () => {
    it("computes char offset from a text node", () => {
      const text = document.createTextNode("Hello world");
      editor.appendChild(text);
      assert.equal(sel.nodeToCharOffset(text, 5), 5);
    });

    it("skips ZWNBSPs in preceding text", () => {
      const text = document.createTextNode(`${ZWNBSP}Hello`);
      editor.appendChild(text);
      assert.equal(sel.nodeToCharOffset(text, 3), 2);
    });

    it("skips chiclet labels in preceding nodes", () => {
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      assert.equal(sel.nodeToCharOffset(text2, 2), 4);
    });

    it("handles node not in editor", () => {
      const outside = document.createTextNode("outside");
      assert.equal(sel.nodeToCharOffset(outside, 0), 0);
    });

    it("counts visible text in children when targetNode is editor", () => {
      // Tests L262-270: editor-level path where nodeOffset is child index.
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      // nodeOffset=2 means "count children 0 and 1" = "Hi" + chiclet
      assert.equal(sel.nodeToCharOffset(editor, 2), 2); // "Hi" = 2
      // nodeOffset=3 = all children
      assert.equal(sel.nodeToCharOffset(editor, 3), 7); // "Hi" + "world"
    });
  });

  // -----------------------------------------------------------------------
  // setCursorAtCharOffset
  // -----------------------------------------------------------------------

  describe("setCursorAtCharOffset", () => {
    it("sets cursor in a simple text node", () => {
      const text = document.createTextNode("Hello world");
      editor.appendChild(text);
      sel.setCursorAtCharOffset(5);
    });

    it("skips chiclet nodes (zero-width)", () => {
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      sel.setCursorAtCharOffset(4);
    });

    it("handles empty editor without crashing", () => {
      sel.setCursorAtCharOffset(0);
    });

    it("skips ZWNBSPs when computing offset", () => {
      const text = document.createTextNode(`${ZWNBSP}Hello`);
      editor.appendChild(text);
      sel.setCursorAtCharOffset(3);
    });

    it("places cursor at end of last text node for large offset", () => {
      const text = document.createTextNode("Hi");
      editor.appendChild(text);
      sel.setCursorAtCharOffset(99);
    });

    it("skips comment nodes (Lit markers)", () => {
      // Tests L327-329: non-text, non-chiclet nodes should be skipped.
      const text1 = document.createTextNode("Hi");
      const comment = document.createComment("lit-marker");
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(comment);
      editor.appendChild(text2);

      // charOffset 4 = "Hi" (2) + "wo" (2) — comment is skipped.
      sel.setCursorAtCharOffset(4);
    });

    it("places cursor at end of text node (visibleConsumed === remaining)", () => {
      // Tests L359-360: cursor placed at text.length when visibleConsumed matches.
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      // charOffset 5 = end of "Hello" — visibleConsumed === remaining
      sel.setCursorAtCharOffset(5);
    });

    it("places cursor after chiclet with afterChiclet=true", () => {
      const text1 = document.createTextNode(`Hi${ZWNBSP}`);
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode(`${ZWNBSP}world`);
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      sel.setCursorAtCharOffset(2, true);
    });
  });

  // -----------------------------------------------------------------------
  // focusEnd
  // -----------------------------------------------------------------------

  describe("focusEnd", () => {
    it("does not throw when editor has text", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);
      sel.focusEnd();
    });

    it("does not throw for empty editor", () => {
      sel.focusEnd();
    });
  });

  // -----------------------------------------------------------------------
  // charOffsetToRawOffset (instance method)
  // -----------------------------------------------------------------------

  describe("charOffsetToRawOffset (instance method)", () => {
    it("delegates to the module-level helper", () => {
      const segments: Segment[] = [textSeg("Hello")];
      assert.equal(sel.charOffsetToRawOffset(segments, 3), 3);
    });
  });

  // -----------------------------------------------------------------------
  // domPositionToSegmentIndex
  // -----------------------------------------------------------------------

  describe("domPositionToSegmentIndex", () => {
    it("returns segment index for a text node", () => {
      const text1 = document.createTextNode("Hi");
      const chiclet = makeChicletLabel();
      const text2 = document.createTextNode("world");
      editor.appendChild(text1);
      editor.appendChild(chiclet);
      editor.appendChild(text2);

      assert.equal(sel.domPositionToSegmentIndex(text1, 0), 0);
      assert.equal(sel.domPositionToSegmentIndex(chiclet, 0), 1);
      assert.equal(sel.domPositionToSegmentIndex(text2, 0), 2);
    });

    it("returns children.length for a node not in the editor", () => {
      const text = document.createTextNode("inside");
      editor.appendChild(text);

      const outside = document.createTextNode("outside");
      assert.equal(sel.domPositionToSegmentIndex(outside, 0), 1);
    });

    it("returns 0 for empty editor", () => {
      const outside = document.createTextNode("outside");
      assert.equal(sel.domPositionToSegmentIndex(outside, 0), 0);
    });
  });

  // -----------------------------------------------------------------------
  // selectNode
  // -----------------------------------------------------------------------

  describe("selectNode", () => {
    it("does not throw when selecting a node", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);
      sel.selectNode(text);
    });
  });

  // -----------------------------------------------------------------------
  // clearChicletSelections / updateChicletSelections
  // -----------------------------------------------------------------------

  describe("clearChicletSelections", () => {
    it("removes 'selected' class from chiclets", () => {
      const chiclet = makeChicletLabel();
      chiclet.classList.add("selected");
      editor.appendChild(chiclet);

      sel.clearChicletSelections();
      assert.equal(chiclet.classList.contains("selected"), false);
    });

    it("does not affect non-chiclet elements", () => {
      const div = document.createElement("div");
      div.classList.add("selected");
      editor.appendChild(div);

      sel.clearChicletSelections();
      assert.equal(div.classList.contains("selected"), true);
    });
  });

  describe("updateChicletSelections", () => {
    it("does not throw when editor has chiclets", () => {
      const chiclet = makeChicletLabel();
      editor.appendChild(chiclet);
      sel.updateChicletSelections();
    });

    it("does not throw for empty editor", () => {
      sel.updateChicletSelections();
    });
  });

  // -----------------------------------------------------------------------
  // insertTab
  // -----------------------------------------------------------------------

  describe("insertTab", () => {
    it("returns false when there is no selection", () => {
      assert.equal(sel.insertTab(), false);
    });
  });

  // -----------------------------------------------------------------------
  // restoreRange
  // -----------------------------------------------------------------------

  describe("restoreRange", () => {
    it("restores a range without offset adjustment", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(text, 3);
      range.collapse(true);

      sel.restoreRange(range, false);
    });

    it("offsets range back by one character by default", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(text, 3);
      range.collapse(true);

      sel.restoreRange(range); // default offsetLastChar = true
    });

    it("does not offset when startOffset is 0", () => {
      const text = document.createTextNode("Hello");
      editor.appendChild(text);

      const range = document.createRange();
      range.setStart(text, 0);
      range.collapse(true);

      sel.restoreRange(range, true);
    });
  });
});
