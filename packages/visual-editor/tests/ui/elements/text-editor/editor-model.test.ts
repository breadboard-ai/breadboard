/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { EditorModel } from "../../../../src/ui/elements/input/text-editor/editor-model.js";
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

function isText(seg: Segment): seg is TextSegment {
  return seg.kind === "text";
}

function isChiclet(seg: Segment): seg is ChicletSegment {
  return seg.kind === "chiclet";
}

describe("EditorModel", () => {
  describe("factories", () => {
    it("creates an empty model", () => {
      const model = EditorModel.empty();
      // ensureTextBoundaries adds a single empty text segment.
      assert.equal(model.length, 1);
      assert.equal(model.toRawValue(), "");
    });

    it("parses plain text", () => {
      const model = EditorModel.fromRawValue("Hello world");
      assert.equal(model.length, 1);
      const seg = model.segmentAt(0)!;
      assert.ok(isText(seg));
      assert.equal(seg.text, "Hello world");
    });

    it("parses a single chiclet", () => {
      const part: TemplatePart = {
        type: "in",
        path: "node-1",
        title: "My Node",
      };
      const raw = `{${JSON.stringify(part)}}`;
      const model = EditorModel.fromRawValue(raw);
      // ["", chiclet, ""] — text boundaries enforced.
      assert.equal(model.length, 3);
      const seg = model.segmentAt(1)!;
      assert.ok(isChiclet(seg));
      assert.equal(seg.part.path, "node-1");
      assert.equal(seg.part.title, "My Node");
    });

    it("parses text + chiclet + text", () => {
      const part: TemplatePart = {
        type: "in",
        path: "node-1",
        title: "Node",
      };
      const raw = `Hello {${JSON.stringify(part)}} world`;
      const model = EditorModel.fromRawValue(raw);
      assert.equal(model.length, 3);
      assert.ok(isText(model.segmentAt(0)!));
      assert.ok(isChiclet(model.segmentAt(1)!));
      assert.ok(isText(model.segmentAt(2)!));
    });

    it("strips pre-existing ZWNBSPs from raw value", () => {
      const model = EditorModel.fromRawValue(`Hello${ZWNBSP}world`);
      assert.equal(model.length, 1);
      const seg = model.segmentAt(0)!;
      assert.ok(isText(seg));
      assert.equal(seg.text, "Helloworld");
    });

    it("handles empty string", () => {
      const model = EditorModel.fromRawValue("");
      // Empty string uses EditorModel.empty() → 1 segment.
      assert.equal(model.length, 1);
    });
  });

  describe("toRawValue (round-trip)", () => {
    it("round-trips plain text", () => {
      const raw = "Hello world";
      assert.equal(EditorModel.fromRawValue(raw).toRawValue(), raw);
    });

    it("round-trips text + chiclet + text", () => {
      const part: TemplatePart = {
        type: "in",
        path: "node-1",
        title: "Node",
      };
      const raw = `Hello {${JSON.stringify(part)}} world`;
      assert.equal(EditorModel.fromRawValue(raw).toRawValue(), raw);
    });

    it("round-trips multiple chiclets", () => {
      const p1: TemplatePart = { type: "in", path: "n1", title: "N1" };
      const p2: TemplatePart = { type: "asset", path: "a1", title: "A1" };
      const raw = `{${JSON.stringify(p1)}} and {${JSON.stringify(p2)}}`;
      assert.equal(EditorModel.fromRawValue(raw).toRawValue(), raw);
    });

    it("round-trips adjacent chiclets (no text between)", () => {
      const p1: TemplatePart = { type: "in", path: "n1", title: "N1" };
      const p2: TemplatePart = { type: "in", path: "n2", title: "N2" };
      const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}`;
      assert.equal(EditorModel.fromRawValue(raw).toRawValue(), raw);
    });

    it("never includes ZWNBSPs in raw value", () => {
      const model = EditorModel.fromRawValue("Hello world");
      const raw = model.toRawValue();
      assert.ok(!raw.includes(ZWNBSP));
    });
  });

  describe("toRenderSegments (ZWNBSP invariant)", () => {
    it("returns single empty text for empty model", () => {
      const model = EditorModel.empty();
      const segs = model.toRenderSegments();
      // Empty model has [""], render segments reflect that.
      assert.equal(segs.length, 1);
      assert.ok(isText(segs[0]));
    });

    it("does not add ZWNBSP for plain text", () => {
      const model = EditorModel.fromRawValue("Hello");
      const segs = model.toRenderSegments();
      assert.equal(segs.length, 1);
      assert.ok(isText(segs[0]));
      assert.equal(segs[0].text, "Hello");
    });

    it("brackets a chiclet with ZWNBSP text segments", () => {
      const part = makePart();
      const raw = `{${JSON.stringify(part)}}`;
      const model = EditorModel.fromRawValue(raw);
      const segs = model.toRenderSegments();

      // Expected: [text(ZWNBSP), chiclet, text(ZWNBSP)]
      assert.equal(segs.length, 3);
      assert.ok(isText(segs[0]));
      assert.ok(segs[0].text.endsWith(ZWNBSP));
      assert.ok(isChiclet(segs[1]));
      assert.ok(isText(segs[2]));
      assert.ok(segs[2].text.startsWith(ZWNBSP));
    });

    it("adds ZWNBSP between text and subsequent chiclet", () => {
      const part = makePart();
      const raw = `Hello{${JSON.stringify(part)}}`;
      const model = EditorModel.fromRawValue(raw);
      const segs = model.toRenderSegments();

      // text("Hello\uFEFF"), chiclet, text("\uFEFF")
      assert.equal(segs.length, 3);
      assert.ok(isText(segs[0]));
      assert.ok(segs[0].text.endsWith(ZWNBSP));
      assert.ok(isChiclet(segs[1]));
      assert.ok(isText(segs[2]));
    });

    it("adds ZWNBSP between chiclet and subsequent text", () => {
      const part = makePart();
      const raw = `{${JSON.stringify(part)}}world`;
      const model = EditorModel.fromRawValue(raw);
      const segs = model.toRenderSegments();

      // text("\uFEFF"), chiclet, text("\uFEFFworld")
      assert.equal(segs.length, 3);
      assert.ok(isText(segs[0]));
      assert.ok(isChiclet(segs[1]));
      assert.ok(isText(segs[2]));
      assert.ok(segs[2].text.startsWith(ZWNBSP));
    });

    it("handles adjacent chiclets with ZWNBSP between them", () => {
      const p1 = makePart({ path: "n1", title: "N1" });
      const p2 = makePart({ path: "n2", title: "N2" });
      const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}`;
      const model = EditorModel.fromRawValue(raw);
      const segs = model.toRenderSegments();

      // text(ZWNBSP), chiclet1, text(ZWNBSP), chiclet2, text(ZWNBSP)
      assert.equal(segs.length, 5);
      assert.ok(isText(segs[0]));
      assert.ok(isChiclet(segs[1]));
      assert.ok(isText(segs[2])); // Between chiclets
      assert.ok(isChiclet(segs[3]));
      assert.ok(isText(segs[4]));
    });

    it("never produces adjacent chiclets without text between", () => {
      const p1 = makePart({ path: "n1" });
      const p2 = makePart({ path: "n2" });
      const p3 = makePart({ path: "n3" });
      const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}{${JSON.stringify(p3)}}`;
      const model = EditorModel.fromRawValue(raw);
      const segs = model.toRenderSegments();

      for (let i = 1; i < segs.length; i++) {
        if (isChiclet(segs[i])) {
          assert.ok(
            isText(segs[i - 1]),
            `Chiclet at index ${i} has no preceding text segment`
          );
        }
      }
    });
  });

  describe("mutations", () => {
    describe("insertChicletAtSegment", () => {
      it("inserts at the beginning", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.insertChicletAtSegment(0, makePart());
        assert.equal(model.length, 2);
        assert.ok(isChiclet(model.segmentAt(0)!));
        assert.ok(isText(model.segmentAt(1)!));
      });

      it("inserts at the end", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.insertChicletAtSegment(1, makePart());
        assert.equal(model.length, 2);
        assert.ok(isText(model.segmentAt(0)!));
        assert.ok(isChiclet(model.segmentAt(1)!));
      });

      it("clamps out-of-range index", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.insertChicletAtSegment(999, makePart());
        assert.equal(model.length, 2);
        assert.ok(isChiclet(model.segmentAt(1)!));
      });
    });

    describe("insertChicletAtOffset", () => {
      it("inserts at the start of text", () => {
        const model = EditorModel.fromRawValue("Hello world");
        model.insertChicletAtOffset(0, makePart());
        // Always preserves separators: ["", chiclet, "Hello world"]
        assert.equal(model.length, 3);
        assert.ok(isChiclet(model.segmentAt(1)!));
      });

      it("splits text at the offset", () => {
        const model = EditorModel.fromRawValue("Hello world");
        model.insertChicletAtOffset(5, makePart());
        assert.equal(model.length, 3);
        assert.ok(isText(model.segmentAt(0)!));
        assert.equal((model.segmentAt(0) as TextSegment).text, "Hello");
        assert.ok(isChiclet(model.segmentAt(1)!));
        assert.ok(isText(model.segmentAt(2)!));
        assert.equal((model.segmentAt(2) as TextSegment).text, " world");
      });

      it("appends when offset is past the end", () => {
        const model = EditorModel.fromRawValue("Hi");
        model.insertChicletAtOffset(999, makePart());
        assert.equal(model.length, 2);
        assert.ok(isChiclet(model.segmentAt(1)!));
      });
    });

    describe("removeSegment", () => {
      it("removes a text segment", () => {
        const model = EditorModel.fromRawValue("Hello world");
        model.removeSegment(0);
        // ensureTextBoundaries re-adds an empty text segment.
        assert.equal(model.length, 1);
        assert.equal(model.toRawValue(), "");
      });

      it("removes a chiclet and merges adjacent text", () => {
        const part = makePart();
        const raw = `Hello{${JSON.stringify(part)}}world`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.length, 3);
        model.removeSegment(1); // Remove the chiclet
        assert.equal(model.length, 1);
        assert.ok(isText(model.segmentAt(0)!));
        assert.equal((model.segmentAt(0) as TextSegment).text, "Helloworld");
      });

      it("ignores out-of-range index", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.removeSegment(5);
        assert.equal(model.length, 1);
      });
    });

    describe("moveChiclet", () => {
      let model: EditorModel;
      const p1 = makePart({ path: "n1", title: "N1" });
      const p2 = makePart({ path: "n2", title: "N2" });

      beforeEach(() => {
        // "Hello" chiclet1 "mid" chiclet2 "end"
        const raw = `Hello{${JSON.stringify(p1)}}mid{${JSON.stringify(p2)}}end`;
        model = EditorModel.fromRawValue(raw);
        assert.equal(model.length, 5);
      });

      it("moves a chiclet forward", () => {
        // Move chiclet at index 1 to index 3 (where chiclet2 is)
        model.moveChiclet(1, 3);
        // After removal: "Hello" "mid" chiclet2 "end" (4 items)
        // Insert at adjusted index 2: "Hello" "mid" chiclet1 chiclet2 "end"
        // Then merge: "Hellomid" chiclet1 chiclet2 "end" (4 items)
        assert.ok(isText(model.segmentAt(0)!));
        assert.equal((model.segmentAt(0) as TextSegment).text, "Hellomid");
      });

      it("does nothing for non-chiclet source", () => {
        model.moveChiclet(0, 3); // Index 0 is text
        assert.equal(model.length, 5); // Unchanged
      });
    });

    describe("updateText", () => {
      it("updates a text segment", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.updateText(0, "Goodbye");
        assert.equal((model.segmentAt(0) as TextSegment).text, "Goodbye");
      });

      it("strips ZWNBSPs from updated text", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.updateText(0, `Good${ZWNBSP}bye`);
        assert.equal((model.segmentAt(0) as TextSegment).text, "Goodbye");
      });

      it("does nothing for chiclet index", () => {
        const part = makePart();
        const model = EditorModel.fromRawValue(`{${JSON.stringify(part)}}`);
        // Model is ["", chiclet, ""] — chiclet is at index 1.
        model.updateText(1, "nope");
        assert.ok(isChiclet(model.segmentAt(1)!));
      });
    });

    describe("replaceAll", () => {
      it("replaces the entire model content", () => {
        const model = EditorModel.fromRawValue("Hello");
        model.replaceAll("Goodbye");
        assert.equal(model.toRawValue(), "Goodbye");
      });

      it("replaces with chiclet content", () => {
        const model = EditorModel.fromRawValue("Hello");
        const part = makePart();
        model.replaceAll(`New {${JSON.stringify(part)}} value`);
        assert.equal(model.length, 3);
        assert.ok(isChiclet(model.segmentAt(1)!));
      });
    });

    describe("insertTextAtOffset", () => {
      it("inserts at the beginning", () => {
        const model = EditorModel.fromRawValue("world");
        const newOffset = model.insertTextAtOffset(0, "Hello ");
        assert.equal(model.toRawValue(), "Hello world");
        assert.equal(newOffset, 6);
      });

      it("inserts in the middle", () => {
        const model = EditorModel.fromRawValue("Helloworld");
        const newOffset = model.insertTextAtOffset(5, " ");
        assert.equal(model.toRawValue(), "Hello world");
        assert.equal(newOffset, 6);
      });

      it("inserts at the end", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.insertTextAtOffset(5, " world");
        assert.equal(model.toRawValue(), "Hello world");
        assert.equal(newOffset, 11);
      });

      it("inserts into empty model", () => {
        const model = EditorModel.empty();
        const newOffset = model.insertTextAtOffset(0, "Hi");
        assert.equal(model.toRawValue(), "Hi");
        assert.equal(newOffset, 2);
      });

      it("returns same offset for empty string", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.insertTextAtOffset(3, "");
        assert.equal(model.toRawValue(), "Hello");
        assert.equal(newOffset, 3);
      });

      it("inserts text after chiclet at segment boundary", () => {
        const p1 = makePart({ path: "n1", title: "N1" });
        const p2 = makePart({ path: "n2", title: "N2" });
        const raw = `A{${JSON.stringify(p1)}}B{${JSON.stringify(p2)}}C`;
        const model = EditorModel.fromRawValue(raw);
        // Visible text is "ABC" (chiclets are zero-width)
        // Insert at offset 2: end of "B" text but chiclet2 follows,
        // so text skips past chiclet2 and goes into "C" segment.
        const newOffset = model.insertTextAtOffset(2, "X");
        assert.equal(newOffset, 3);
        // "X" is inserted before "C" (after chiclet2)
        const rawValue = model.toRawValue();
        assert.ok(rawValue.includes("XC"));
      });

      it("appends to end past all segments", () => {
        const model = EditorModel.fromRawValue("Hi");
        const newOffset = model.insertTextAtOffset(999, "!");
        assert.ok(model.toRawValue().endsWith("!"));
        assert.equal(newOffset, model.visibleTextLength);
      });

      it("uses segmentHint to insert between adjacent chiclets", () => {
        // Simulate: drag chiclet B before chiclet A → ["", B, "", A, " and "]
        const model = EditorModel.fromRawValue(" and ");
        const partA = makePart({ path: "A" });
        const partB = makePart({ path: "B" });
        model.insertChicletAtOffset(0, partA);
        model.insertChicletAtOffset(0, partB);

        // Model: ["", B, "", A, " and "]
        assert.equal(model.length, 5);

        // Without segmentHint, offset 0 skips past all chiclets:
        const offset1 = model.insertTextAtOffset(0, "X");
        // "X" goes after B because it skips empty segment, hits B, skips
        // to next empty, hits A, arrives at " and ".
        assert.equal(offset1, 1);

        // Build a fresh model to test segmentHint.
        // Re-parse: we want to test segmentHint, so build model manually.
        const model2 = EditorModel.fromRawValue(" and ");
        model2.insertChicletAtOffset(0, partA);
        model2.insertChicletAtOffset(0, partB);
        // Model2: ["", B, "", A, " and "]

        // With segmentHint=2 (the "" between B and A), insertion stays there:
        const offset2 = model2.insertTextAtOffset(0, "Y", 2);
        assert.equal(offset2, 1);
        // Segments[2] was "", now "Y". Model: ["", B, "Y", A, " and "]
        const seg2 = model2.segmentAt(2);
        assert.ok(seg2 && seg2.kind === "text");
        if (seg2 && seg2.kind === "text") {
          assert.equal(seg2.text, "Y");
        }
      });
    });

    describe("deleteAtOffset (backward)", () => {
      it("deletes one character backward", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(5, -1);
        assert.equal(model.toRawValue(), "Hell");
        assert.equal(newOffset, 4);
      });

      it("deletes from the middle", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(3, -1);
        assert.equal(model.toRawValue(), "Helo");
        assert.equal(newOffset, 2);
      });

      it("deletes at the start (no-op clamp)", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(0, -1);
        assert.equal(model.toRawValue(), "Hello");
        assert.equal(newOffset, 0);
      });

      it("deletes multiple characters backward", () => {
        const model = EditorModel.fromRawValue("Hello world");
        const newOffset = model.deleteAtOffset(5, -5);
        assert.equal(model.toRawValue(), " world");
        assert.equal(newOffset, 0);
      });

      it("returns count 0 as no-op", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(3, 0);
        assert.equal(model.toRawValue(), "Hello");
        assert.equal(newOffset, 3);
      });

      it("removes chiclet at boundary (backspace)", () => {
        const part = makePart();
        const raw = `Hello{${JSON.stringify(part)}}world`;
        const model = EditorModel.fromRawValue(raw);
        // Visible text: "Helloworld" (10 chars), chiclet at offset 5
        const newOffset = model.deleteAtOffset(5, -1);
        assert.equal(model.toRawValue(), "Helloworld");
        assert.equal(newOffset, 5);
        assert.equal(model.length, 1); // Merged into one text segment
      });

      it("prefers chiclet over text at boundary", () => {
        // With "This is [chiclet]", backspace from offset 8 removes chiclet
        const part = makePart();
        const raw = `This is {${JSON.stringify(part)}}`;
        const model = EditorModel.fromRawValue(raw);
        // ["This is ", chiclet, ""] — 3 segments with text boundaries.
        assert.equal(model.length, 3);
        const newOffset = model.deleteAtOffset(8, -1);
        assert.equal(model.toRawValue(), "This is ");
        assert.equal(newOffset, 8);
        assert.equal(model.length, 1);
      });
    });

    describe("deleteAtOffset (forward)", () => {
      it("deletes one character forward", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(0, 1);
        assert.equal(model.toRawValue(), "ello");
        assert.equal(newOffset, 0);
      });

      it("deletes from the middle forward", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(2, 1);
        assert.equal(model.toRawValue(), "Helo");
        assert.equal(newOffset, 2);
      });

      it("deletes at the end (no-op)", () => {
        const model = EditorModel.fromRawValue("Hello");
        const newOffset = model.deleteAtOffset(5, 1);
        assert.equal(model.toRawValue(), "Hello");
        assert.equal(newOffset, 5);
      });
    });

    describe("visibleTextLength", () => {
      it("returns 0 for empty model", () => {
        assert.equal(EditorModel.empty().visibleTextLength, 0);
      });

      it("returns text length for plain text", () => {
        const model = EditorModel.fromRawValue("Hello");
        assert.equal(model.visibleTextLength, 5);
      });

      it("ignores chiclets (zero-width)", () => {
        const part = makePart();
        const raw = `Hello{${JSON.stringify(part)}}world`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.visibleTextLength, 10); // "Hello" + "world"
      });

      it("returns 0 for chiclet-only model", () => {
        const part = makePart();
        const raw = `{${JSON.stringify(part)}}`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.visibleTextLength, 0);
      });
    });
  });

  describe("findSegmentByPart", () => {
    it("finds a chiclet by its TemplatePart reference", () => {
      const part = makePart({ path: "n1", title: "N1" });
      const raw = `Hello{${JSON.stringify(part)}}world`;
      const model = EditorModel.fromRawValue(raw);
      const chicletSeg = model.segmentAt(1)!;
      assert.ok(isChiclet(chicletSeg));
      assert.equal(model.findSegmentByPart(chicletSeg.part), 1);
    });

    it("returns -1 for a part not in the model", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.findSegmentByPart(makePart()), -1);
    });
  });

  describe("chicletCharOffset", () => {
    it("returns 0 for a chiclet at the start", () => {
      const part = makePart();
      const raw = `{${JSON.stringify(part)}}Hello`;
      const model = EditorModel.fromRawValue(raw);
      assert.equal(model.chicletCharOffset(0), 0);
    });

    it("returns visible text length before the chiclet", () => {
      const part = makePart();
      const raw = `Hello{${JSON.stringify(part)}}world`;
      const model = EditorModel.fromRawValue(raw);
      assert.equal(model.chicletCharOffset(1), 5); // "Hello" = 5 chars
    });

    it("returns 0 for non-chiclet index at start", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.chicletCharOffset(0), 0);
    });

    it("returns total text length for out-of-range index", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.chicletCharOffset(99), 5);
    });
  });

  describe("rawSlice", () => {
    it("extracts plain text by char offsets", () => {
      const model = EditorModel.fromRawValue("Hello world");
      assert.equal(model.rawSlice(0, 5), "Hello");
      assert.equal(model.rawSlice(6, 11), "world");
    });

    it("extracts text that includes a chiclet", () => {
      const part = makePart();
      const raw = `Hello{${JSON.stringify(part)}}world`;
      const model = EditorModel.fromRawValue(raw);
      // Visible text "Helloworld" (10 chars), chiclet between 5 and 5.
      // Slice 0..10 should return the full raw value including chiclet.
      const result = model.rawSlice(0, 10);
      assert.equal(result, raw);
    });

    it("returns empty string for collapsed range", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.rawSlice(3, 3), "");
    });
  });

  describe("history (undo / redo)", () => {
    it("pushSnapshot records state and undo restores it", () => {
      const model = EditorModel.fromRawValue("Hello");
      // Push snapshot after initial state.
      model.pushSnapshot(5);

      // Mutate.
      model.insertTextAtOffset(5, " world");
      model.pushSnapshot(11);

      assert.equal(model.toRawValue(), "Hello world");

      // Undo.
      const result = model.undo();
      assert.ok(result);
      assert.equal(result!.cursorOffset, 5);
      assert.equal(model.toRawValue(), "Hello");
    });

    it("redo restores a previously undone state", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.pushSnapshot(5);

      model.insertTextAtOffset(5, " world");
      model.pushSnapshot(11);

      model.undo();
      assert.equal(model.toRawValue(), "Hello");

      const result = model.redo();
      assert.ok(result);
      assert.equal(result!.cursorOffset, 11);
      assert.equal(model.toRawValue(), "Hello world");
    });

    it("undo returns null when at the beginning of history", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.undo(), null);
    });

    it("redo returns null when at the end of history", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.redo(), null);
    });

    it("new mutation after undo discards redo stack", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.pushSnapshot(5);

      model.insertTextAtOffset(5, " world");
      model.pushSnapshot(11);

      // Undo, then push new mutation.
      model.undo();
      model.insertTextAtOffset(5, "!");
      model.pushSnapshot(6);

      // Redo should return null (discarded).
      assert.equal(model.redo(), null);
      assert.equal(model.toRawValue(), "Hello!");
    });

    it("replaceAll clears history", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.pushSnapshot(5);

      model.insertTextAtOffset(5, " world");
      model.pushSnapshot(11);

      model.replaceAll("Fresh start");
      assert.equal(model.undo(), null);
    });

    it("preserves afterChiclet flag in snapshots", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.pushSnapshot(5, true);

      model.insertTextAtOffset(5, " world");
      model.pushSnapshot(11, false);

      const result = model.undo();
      assert.ok(result);
      assert.equal(result!.afterChiclet, true);
    });

    it("handles chiclet undo correctly", () => {
      const part = makePart();
      const model = EditorModel.fromRawValue("Hello");
      model.pushSnapshot(5);

      model.insertChicletAtOffset(5, part);
      model.pushSnapshot(5, true);

      // Always preserves separators: ["Hello", chiclet, ""]
      assert.equal(model.length, 3);

      const result = model.undo();
      assert.ok(result);
      assert.equal(model.length, 1);
      assert.equal(model.toRawValue(), "Hello");
    });

    it("undoes back to empty initial state", () => {
      const model = EditorModel.empty();
      // Initial history is seeded by constructor: [{[""], 0}]

      model.insertTextAtOffset(0, "Hello");
      model.pushSnapshot(5);

      assert.equal(model.toRawValue(), "Hello");

      const result = model.undo();
      assert.ok(result);
      assert.equal(result!.cursorOffset, 0);
      assert.equal(model.toRawValue(), "");
      // ensureTextBoundaries means empty model has 1 segment.
      assert.equal(model.length, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteAtOffset
  // ---------------------------------------------------------------------------

  describe("deleteAtOffset", () => {
    it("deletes a single character backward (backspace)", () => {
      const model = EditorModel.fromRawValue("Hello");
      const newOffset = model.deleteAtOffset(5, -1);
      assert.equal(model.toRawValue(), "Hell");
      assert.equal(newOffset, 4);
    });

    it("deletes a single character forward (delete key)", () => {
      const model = EditorModel.fromRawValue("Hello");
      const newOffset = model.deleteAtOffset(0, 1);
      assert.equal(model.toRawValue(), "ello");
      assert.equal(newOffset, 0);
    });

    it("returns same offset for count=0", () => {
      const model = EditorModel.fromRawValue("Hello");
      const newOffset = model.deleteAtOffset(3, 0);
      assert.equal(model.toRawValue(), "Hello");
      assert.equal(newOffset, 3);
    });

    it("deletes multiple characters backward", () => {
      const model = EditorModel.fromRawValue("Hello world");
      const newOffset = model.deleteAtOffset(11, -6);
      assert.equal(model.toRawValue(), "Hello");
      assert.equal(newOffset, 5);
    });

    it("removes chiclet at boundary (backspace)", () => {
      const model = EditorModel.fromRawValue("Hello");
      const part = makePart();
      model.insertChicletAtOffset(5, part);
      // Always preserves separators: ["Hello", chiclet, ""]
      assert.equal(model.length, 3);

      const newOffset = model.deleteAtOffset(5, -1);
      // After removal + merge: ["Hello"]
      assert.equal(model.length, 1);
      assert.equal(model.toRawValue(), "Hello");
      assert.equal(newOffset, 5);
    });

    it("removes chiclet at boundary (delete key)", () => {
      const part = makePart();
      const model = EditorModel.fromRawValue("Hello");
      model.insertChicletAtOffset(5, part);

      const newOffset = model.deleteAtOffset(5, 1);
      assert.equal(model.length, 1);
      assert.equal(model.toRawValue(), "Hello");
      assert.equal(newOffset, 5);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSelection
  // ---------------------------------------------------------------------------

  describe("deleteSelection", () => {
    it("deletes a text range", () => {
      const model = EditorModel.fromRawValue("Hello world");
      const newOffset = model.deleteSelection(5, 11);
      assert.equal(model.toRawValue(), "Hello");
      assert.equal(newOffset, 5);
    });

    it("deletes a range including a chiclet", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.insertChicletAtOffset(5, makePart());
      model.insertTextAtOffset(5, " world");

      // Delete from 5 to 11 — should remove " world" and the chiclet.
      const newOffset = model.deleteSelection(0, 5);
      assert.equal(newOffset, 0);
    });
  });

  // ---------------------------------------------------------------------------
  // visibleTextLength
  // ---------------------------------------------------------------------------

  describe("visibleTextLength", () => {
    it("returns length for plain text", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.visibleTextLength, 5);
    });

    it("returns 0 for empty model", () => {
      const model = EditorModel.empty();
      assert.equal(model.visibleTextLength, 0);
    });

    it("excludes chiclets from length", () => {
      const model = EditorModel.fromRawValue("Hi");
      model.insertChicletAtOffset(2, makePart());
      // Chiclet is zero-width, text is still "Hi" = 2
      assert.equal(model.visibleTextLength, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // hasChicletAtBoundary
  // ---------------------------------------------------------------------------

  describe("hasChicletAtBoundary", () => {
    it("returns true when chiclet is at the offset", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.insertChicletAtOffset(5, makePart());
      assert.equal(model.hasChicletAtBoundary(5), true);
    });

    it("returns false for plain text offset", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.hasChicletAtBoundary(3), false);
    });

    it("returns false for empty model", () => {
      const model = EditorModel.empty();
      assert.equal(model.hasChicletAtBoundary(0), false);
    });
  });

  // ---------------------------------------------------------------------------
  // charOffsetToRawOffset
  // ---------------------------------------------------------------------------

  describe("charOffsetToRawOffset", () => {
    it("maps offset in plain text directly", () => {
      const model = EditorModel.fromRawValue("Hello world");
      assert.equal(model.charOffsetToRawOffset(0), 0);
      assert.equal(model.charOffsetToRawOffset(5), 5);
      assert.equal(model.charOffsetToRawOffset(11), 11);
    });

    it("skips chiclet raw length", () => {
      const part = makePart();
      const model = EditorModel.fromRawValue("Hi");
      model.insertChicletAtOffset(2, part);

      // "Hi" has charOffset 2 = raw offset 2 (before chiclet)
      assert.equal(model.charOffsetToRawOffset(2), 2);
    });

    it("returns total raw length for offset past end", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.charOffsetToRawOffset(100), 5);
    });
  });

  // ---------------------------------------------------------------------------
  // findWordBoundaryBefore / findWordBoundaryAfter
  // ---------------------------------------------------------------------------

  describe("findWordBoundaryBefore", () => {
    it("finds start of current word", () => {
      const model = EditorModel.fromRawValue("Hello world");
      assert.equal(model.findWordBoundaryBefore(11), 6);
    });

    it("skips whitespace then finds word start", () => {
      const model = EditorModel.fromRawValue("Hello  world");
      assert.equal(model.findWordBoundaryBefore(7), 0);
    });

    it("returns 0 at start of text", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.findWordBoundaryBefore(0), 0);
    });
  });

  describe("findWordBoundaryAfter", () => {
    it("finds end of current word", () => {
      const model = EditorModel.fromRawValue("Hello world");
      assert.equal(model.findWordBoundaryAfter(0), 6);
    });

    it("returns text length at end", () => {
      const model = EditorModel.fromRawValue("Hello");
      assert.equal(model.findWordBoundaryAfter(5), 5);
    });

    it("skips through word then whitespace", () => {
      const model = EditorModel.fromRawValue("Hello world");
      assert.equal(model.findWordBoundaryAfter(6), 11);
    });
  });

  // ---------------------------------------------------------------------------
  // updateChiclet / updateText
  // ---------------------------------------------------------------------------

  describe("updateChiclet", () => {
    it("replaces the part of a chiclet", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.insertChicletAtOffset(5, makePart({ path: "old" }));

      const seg = model.segmentAt(1);
      assert.ok(seg && isChiclet(seg));
      assert.equal(seg.part.path, "old");

      model.updateChiclet(1, makePart({ path: "new" }));

      const updated = model.segmentAt(1);
      assert.ok(updated && isChiclet(updated));
      assert.equal(updated.part.path, "new");
    });

    it("does nothing for invalid index", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.updateChiclet(99, makePart()); // no throw
      assert.equal(model.toRawValue(), "Hello");
    });

    it("does nothing for text segment index", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.updateChiclet(0, makePart()); // no throw, index 0 is text
      const seg = model.segmentAt(0);
      assert.ok(seg && isText(seg));
    });
  });

  describe("updateText", () => {
    it("replaces text content of a segment", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.updateText(0, "Goodbye");
      assert.equal(model.toRawValue(), "Goodbye");
    });
  });

  // ---------------------------------------------------------------------------
  // removeSegment / moveChiclet
  // ---------------------------------------------------------------------------

  describe("removeSegment", () => {
    it("removes a segment and merges adjacent text", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.insertChicletAtOffset(2, makePart());
      assert.equal(model.length, 3); // "He" + chiclet + "llo"

      model.removeSegment(1); // remove chiclet
      assert.equal(model.length, 1); // merged "Hello"
      assert.equal(model.toRawValue(), "Hello");
    });
  });

  describe("moveChiclet", () => {
    it("moves a chiclet to a new position", () => {
      const model = EditorModel.fromRawValue("AB");
      const partA = makePart({ path: "A" });
      model.insertChicletAtOffset(1, partA);
      // Segments: ["A", chiclet(A), "B"]
      assert.equal(model.length, 3);

      // toIndex is in original coordinates; after removing index 1,
      // adjustedTo = 3 - 1 = 2 → insert at end.
      model.moveChiclet(1, 3);
      // ensureTextBoundaries adds trailing text: [..., chiclet, ""]
      const chiclet = model.segmentAt(model.length - 2);
      assert.ok(chiclet && isChiclet(chiclet));
      assert.equal(chiclet.part.path, "A");
    });
  });

  // ---------------------------------------------------------------------------
  // captureSnapshot / pushPreparedSnapshot / truncateHistoryTo
  // ---------------------------------------------------------------------------

  describe("captureSnapshot", () => {
    it("captures current model state without pushing", () => {
      const model = EditorModel.fromRawValue("Hello");
      const snap = model.captureSnapshot(5);
      assert.equal(snap.cursorOffset, 5);
      assert.equal(snap.afterChiclet, false);
      assert.equal(snap.segments.length, 1);

      // Doesn't affect history — undo returns null (only seed snapshot).
      assert.equal(model.undo(), null);
    });
  });

  describe("pushPreparedSnapshot", () => {
    it("pushes a previously captured snapshot", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.captureSnapshot(5); // capture without pushing

      model.insertTextAtOffset(5, " world");
      model.pushPreparedSnapshot(model.captureSnapshot(11));

      const result = model.undo();
      assert.ok(result);
      // Undo goes to the seed snapshot (constructor), not the captured one,
      // because captureSnapshot didn't push.
    });
  });

  describe("truncateHistoryTo", () => {
    it("discards snapshots after the given index", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.pushSnapshot(5);
      model.insertTextAtOffset(5, " world");
      model.pushSnapshot(11);

      assert.equal(model.historyIndex, 2);

      model.truncateHistoryTo(0);
      assert.equal(model.historyIndex, 0);

      // After truncation, undo returns null (at oldest).
      assert.equal(model.undo(), null);
    });

    it("ignores invalid index", () => {
      const model = EditorModel.fromRawValue("Hello");
      model.truncateHistoryTo(-1); // no throw
      model.truncateHistoryTo(999); // no throw
      assert.equal(model.historyIndex, 0);
    });
  });
});
