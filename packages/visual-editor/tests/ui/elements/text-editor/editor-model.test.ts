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

    it("inserts an empty text segment between adjacent chiclets during parsing", () => {
      const p1: TemplatePart = { type: "in", path: "n1", title: "N1" };
      const p2: TemplatePart = { type: "in", path: "n2", title: "N2" };
      const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}`;
      const model = EditorModel.fromRawValue(raw);

      // Expected model structure: [text(""), chiclet1, text(""), chiclet2, text("")]
      assert.equal(model.length, 5);
      assert.ok(isText(model.segmentAt(0)!));
      assert.ok(isChiclet(model.segmentAt(1)!));
      assert.ok(isText(model.segmentAt(2)!));
      assert.equal((model.segmentAt(2) as TextSegment).text, "");
      assert.ok(isChiclet(model.segmentAt(3)!));
      assert.ok(isText(model.segmentAt(4)!));
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

    describe("trailing newline rendering (sentinel)", () => {
      it("appends an extra newline when the model ends with a newline in a text segment", () => {
        const model = EditorModel.fromRawValue("Hello\n");
        const segs = model.toRenderSegments();
        assert.equal(segs.length, 1);
        assert.ok(isText(segs[0]));
        assert.equal(segs[0].text, "Hello\n\n");
      });

      it("appends an extra newline when the last segment is an empty text segment after a newline", () => {
        // Model: ["Hello\n", c1, ""]
        // The last segment is "" which is text, but it's not ending with a newline itself.
        // Wait, does the last segment end with a newline in this case?
        // Let's see: if model is "Hello\n{chiclet}", the last segment is "". It doesn't end with a newline.
        // What if model is "Hello\n{chiclet}\n"?
        // The raw string has a newline at the end. The parsed segments are:
        // ["Hello\n", c1, "\n"]
        // The last segment is "\n".
        const part = makePart();
        const raw = `Hello\n{${JSON.stringify(part)}}\n`;
        const model = EditorModel.fromRawValue(raw);
        const segs = model.toRenderSegments();

        // Expected segments: ["Hello\n", c1, "\uFEFF\n\n"] (since the last segment is text "\n",
        // it starts with ZWNBSP because of the preceding chiclet, and ends with an extra \n).
        assert.equal(segs.length, 3);
        assert.ok(isText(segs[2]));
        assert.equal(segs[2].text, `${ZWNBSP}\n\n`);
      });

      it("appends an extra newline for a model that is only a newline", () => {
        const model = EditorModel.fromRawValue("\n");
        const segs = model.toRenderSegments();
        assert.equal(segs.length, 1);
        assert.ok(isText(segs[0]));
        assert.equal(segs[0].text, "\n\n");
      });

      it("does not append an extra newline if there is text after the newline", () => {
        const model = EditorModel.fromRawValue("Hello\nworld");
        const segs = model.toRenderSegments();
        assert.equal(segs.length, 1);
        assert.ok(isText(segs[0]));
        assert.equal(segs[0].text, "Hello\nworld");
      });
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
        // Text-boundary invariant: [text, chiclet, text("")]
        assert.equal(model.length, 3);
        assert.ok(isText(model.segmentAt(0)!));
        assert.ok(isChiclet(model.segmentAt(1)!));
        assert.ok(isText(model.segmentAt(2)!));
        assert.equal((model.segmentAt(2) as TextSegment).text, "");
      });

      it("maintains text boundary after drag-to-end (regression)", () => {
        // Simulate: "Hello [chiclet] world" → drag chiclet to end
        const part = makePart();
        const raw = `Hello{${JSON.stringify(part)}} world`;
        const model = EditorModel.fromRawValue(raw);
        // ["Hello", chiclet, " world"]
        assert.equal(model.length, 3);

        // Remove chiclet (drag start)
        model.removeSegment(1);
        // After merge: ["Hello world"]
        assert.equal(model.length, 1);

        // Re-insert at end offset (drag drop at end of visible text)
        const endOffset = model.visibleTextLength; // 11
        model.insertChicletAtOffset(endOffset, part);
        // Should be: ["Hello world", chiclet, ""]
        assert.equal(model.length, 3);
        assert.ok(isText(model.segmentAt(0)!));
        assert.ok(isChiclet(model.segmentAt(1)!));
        assert.ok(isText(model.segmentAt(2)!));

        // Now inserting text (Enter key) into the trailing segment must work.
        // segmentHint=2 tells the model the cursor is in the trailing text.
        const newOffset = model.insertTextAtOffset(endOffset, "\n", 2);
        assert.equal(newOffset, endOffset + 1);
        assert.ok(model.toRawValue().endsWith("\n"));
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

    describe("deleteAtOffset with segmentHint (adjacent chiclets)", () => {
      // Model: ["text ", c1, "", c2, "", c3, ""]
      // All three chiclets share visible offset 5 (the text is 5 chars).
      // Without segmentHint, backspace always deletes c1. With the hint,
      // the correct chiclet is targeted.

      function makeAdjacentModel(): {
        model: EditorModel;
      } {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const raw = `text {${JSON.stringify(p1)}}{${JSON.stringify(p2)}}{${JSON.stringify(p3)}}`;
        const model = EditorModel.fromRawValue(raw);
        // Expected structure: ["text ", c1, "", c2, "", c3, ""]
        assert.equal(model.length, 7, "sanity: 7 alternating segments");
        return { model };
      }

      it("backspace from end (hint=6) deletes the last chiclet (c3)", () => {
        const { model } = makeAdjacentModel();
        // Cursor is in segment 6 (trailing ""), hint=6, backspace.
        const newOffset = model.deleteAtOffset(5, -1, 6);
        assert.equal(newOffset, 5);

        // c3 should be gone; c1 and c2 remain.
        const remaining: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) remaining.push(seg.part.path);
        }
        assert.deepEqual(remaining, ["p1", "p2"]);
      });

      it("backspace from middle (hint=4) deletes c2", () => {
        const { model } = makeAdjacentModel();
        // Cursor is in segment 4 (empty text between c2 and c3), hint=4.
        const newOffset = model.deleteAtOffset(5, -1, 4);
        assert.equal(newOffset, 5);

        const remaining: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) remaining.push(seg.part.path);
        }
        assert.deepEqual(remaining, ["p1", "p3"]);
      });

      it("backspace right after text (hint=2) deletes c1", () => {
        const { model } = makeAdjacentModel();
        // Cursor is in segment 2 (empty text between c1 and c2), hint=2.
        const newOffset = model.deleteAtOffset(5, -1, 2);
        assert.equal(newOffset, 5);

        const remaining: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) remaining.push(seg.part.path);
        }
        assert.deepEqual(remaining, ["p2", "p3"]);
      });

      it("forward delete from text (hint=0) deletes c1", () => {
        const { model } = makeAdjacentModel();
        // Cursor is in segment 0 ("text "), forward delete.
        const newOffset = model.deleteAtOffset(5, 1, 0);
        assert.equal(newOffset, 5);

        const remaining: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) remaining.push(seg.part.path);
        }
        assert.deepEqual(remaining, ["p2", "p3"]);
      });

      it("forward delete between c1 and c2 (hint=2) deletes c2", () => {
        const { model } = makeAdjacentModel();
        // Cursor is in segment 2 (empty text between c1 and c2), forward.
        const newOffset = model.deleteAtOffset(5, 1, 2);
        assert.equal(newOffset, 5);

        const remaining: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) remaining.push(seg.part.path);
        }
        assert.deepEqual(remaining, ["p1", "p3"]);
      });

      it("falls back to findChicletAtBoundary when no hint", () => {
        // Without hint, backspace at boundary still works for single chiclets.
        const part = makePart();
        const raw = `Hello{${JSON.stringify(part)}}world`;
        const model = EditorModel.fromRawValue(raw);
        const newOffset = model.deleteAtOffset(5, -1);
        assert.equal(model.toRawValue(), "Helloworld");
        assert.equal(newOffset, 5);
      });
    });

    describe("multi-line with chiclets and newlines", () => {
      // These tests cover the gnarly edge cases that surface in the live
      // editor: newlines between chiclets, chiclets at end of lines,
      // and mixed content with adjacent chiclets separated by newlines.

      // Helper: build model from raw string and assert expected segment count.
      function buildModel(raw: string, expectedLength: number): EditorModel {
        const model = EditorModel.fromRawValue(raw);
        assert.equal(
          model.length,
          expectedLength,
          `expected ${expectedLength} segments for raw: ${raw.slice(0, 60)}...`
        );
        return model;
      }

      // Helper: collect chiclet paths from a model.
      function chicletPaths(model: EditorModel): string[] {
        const paths: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) paths.push(seg.part.path);
        }
        return paths;
      }

      // Helper: collect text content (concatenated) from a model.
      function allText(model: EditorModel): string {
        let result = "";
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isText(seg)) result += seg.text;
        }
        return result;
      }

      // --- Parsing ---

      it("parses chiclet-newline-chiclet correctly", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const raw = `{${JSON.stringify(p1)}}\n{${JSON.stringify(p2)}}`;
        // Expected: ["", c1, "\n", c2, ""]
        const model = buildModel(raw, 5);
        assert.ok(isText(model.segmentAt(0)!));
        assert.ok(isChiclet(model.segmentAt(1)!));
        const textSeg = model.segmentAt(2)!;
        assert.ok(isText(textSeg));
        assert.equal((textSeg as TextSegment).text, "\n");
        assert.ok(isChiclet(model.segmentAt(3)!));
        assert.ok(isText(model.segmentAt(4)!));
      });

      it("parses text-chiclet-newline-chiclet-chiclet", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const raw = `text {${JSON.stringify(p1)}}\n{${JSON.stringify(p2)}}{${JSON.stringify(p3)}}`;
        // Expected: ["text ", c1, "\n", c2, "", c3, ""]
        const model = buildModel(raw, 7);
        assert.deepEqual(chicletPaths(model), ["p1", "p2", "p3"]);
        assert.equal(allText(model), "text \n");
      });

      // --- Backspace (deleteAtOffset, count=-1) ---

      it("backspace on empty line deletes newline, not chiclet (hint)", () => {
        // Model: ["text ", c1, "\n", c2, "\n", c3, ""]
        //                              ^^^ cursor here, end of seg 4
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const raw = `text {${JSON.stringify(p1)}}\n{${JSON.stringify(p2)}}\n{${JSON.stringify(p3)}}`;
        const model = buildModel(raw, 7);

        // charOffset: "text " (5) + "\n" (1) + "\n" (1) = 7
        // segmentHint: 4 (the "\n" between c2 and c3)
        // localOffset within seg 4: 7 - (5+1) = 1 (end of "\n")
        // Since localOffset !== 0, should NOT delete c2 — should delete "\n"
        const newOffset = model.deleteAtOffset(7, -1, 4);
        assert.equal(newOffset, 6);
        assert.deepEqual(chicletPaths(model), ["p1", "p2", "p3"]);
        assert.equal(allText(model), "text \n");
      });

      it("backspace at start of newline segment (hint=4, localOffset=0) deletes chiclet", () => {
        // Model: ["text ", c1, "\n", c2, "\n", c3, ""]
        //                              ^^^ cursor at START of seg 4
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const raw = `text {${JSON.stringify(p1)}}\n{${JSON.stringify(p2)}}\n{${JSON.stringify(p3)}}`;
        const model = buildModel(raw, 7);

        // charOffset: "text " (5) + "\n" (1) = 6
        // segmentHint: 4, localOffset = 6 - 6 = 0 → at leading edge
        const newOffset = model.deleteAtOffset(6, -1, 4);
        assert.equal(newOffset, 6);
        assert.deepEqual(chicletPaths(model), ["p1", "p3"]);
      });

      it("backspace at very end after trailing chiclet deletes chiclet", () => {
        // Model: ["text\n", c1, ""]
        // Cursor at end (seg 2, ""), charOffset = 5, localOffset = 0
        const p1 = makePart({ path: "p1" });
        const raw = `text\n{${JSON.stringify(p1)}}`;
        const model = buildModel(raw, 3);

        const newOffset = model.deleteAtOffset(5, -1, 2);
        assert.equal(newOffset, 5);
        assert.deepEqual(chicletPaths(model), []);
        assert.equal(allText(model), "text\n");
      });

      it("backspace mid-text does not touch adjacent chiclet", () => {
        // Model: ["Hello\n", c1, "world"]
        // Cursor in seg 0 at offset 3 ("Hel|lo\n"), hint=0, localOffset=3
        const p1 = makePart({ path: "p1" });
        const raw = `Hello\n{${JSON.stringify(p1)}}world`;
        const model = buildModel(raw, 3);

        const newOffset = model.deleteAtOffset(3, -1, 0);
        assert.equal(newOffset, 2);
        assert.deepEqual(chicletPaths(model), ["p1"]);
        assert.equal(allText(model), "Helo\nworld");
      });

      // --- Forward delete (deleteAtOffset, count=1) ---

      it("forward delete at end of text before chiclet on next line deletes newline first", () => {
        // Model: ["text\n", c1, ""]
        // Cursor at offset 4 in seg 0 ("text|\\n"), localOffset = 4, segLen = 5
        // localOffset !== segLen → text delete, not chiclet
        const p1 = makePart({ path: "p1" });
        const raw = `text\n{${JSON.stringify(p1)}}`;
        const model = buildModel(raw, 3);

        const newOffset = model.deleteAtOffset(4, 1, 0);
        assert.equal(newOffset, 4);
        assert.deepEqual(chicletPaths(model), ["p1"]);
        assert.equal(allText(model), "text");
      });

      it("forward delete at end of text (past newline) deletes chiclet", () => {
        // Model: ["text\n", c1, ""]
        // Cursor at offset 5 in seg 0 ("text\n|"), localOffset = 5 = segLen
        // → at trailing edge → delete c1
        const p1 = makePart({ path: "p1" });
        const raw = `text\n{${JSON.stringify(p1)}}`;
        const model = buildModel(raw, 3);

        const newOffset = model.deleteAtOffset(5, 1, 0);
        assert.equal(newOffset, 5);
        assert.deepEqual(chicletPaths(model), []);
      });

      // --- Insertion (insertTextAtOffset) ---

      it("inserts newline after trailing chiclet", () => {
        // Model: ["text ", c1, ""]
        // Insert "\n" at charOffset 5, segmentHint = 2 (trailing "")
        const p1 = makePart({ path: "p1" });
        const raw = `text {${JSON.stringify(p1)}}`;
        const model = buildModel(raw, 3);

        const newOffset = model.insertTextAtOffset(5, "\n", 2);
        assert.equal(newOffset, 6);
        assert.equal(allText(model), "text \n");
        assert.deepEqual(chicletPaths(model), ["p1"]);
      });

      it("inserts newline between adjacent chiclets at correct position", () => {
        // Model: ["", c1, "", c2, ""]
        // Insert "\n" at charOffset 0, segmentHint = 2 (between c1 and c2)
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}`;
        const model = buildModel(raw, 5);

        const newOffset = model.insertTextAtOffset(0, "\n", 2);
        assert.equal(newOffset, 1);
        // Text between c1 and c2 should now be "\n"
        const midSeg = model.segmentAt(2)!;
        assert.ok(isText(midSeg));
        assert.equal((midSeg as TextSegment).text, "\n");
      });

      // --- Chiclet insertion (insertChicletAtOffset) ---

      it("inserts chiclet after newline-separated chiclets with correct hint", () => {
        // Model: ["text\n", c1, "\n", c2, ""]
        // Insert c3 at charOffset 6 (end), segmentHint = 4 (trailing "")
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const raw = `text\n{${JSON.stringify(p1)}}\n{${JSON.stringify(p2)}}`;
        const model = buildModel(raw, 5);

        model.insertChicletAtOffset(6, p3, true, 4);
        assert.deepEqual(chicletPaths(model), ["p1", "p2", "p3"]);
      });

      // --- Round-trip ---

      it("round-trips multi-line chiclet content through toRawValue", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const raw = `text {${JSON.stringify(p1)}}\n{${JSON.stringify(p2)}}{${JSON.stringify(p3)}}`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.toRawValue(), raw);
      });

      // --- Successive deletions ---

      it("successive backspaces delete text before chiclets, not chiclets", () => {
        // Model: ["ab", c1, "cd", c2, "ef"]
        // Cursor in seg 2 ("cd"), offset 7 (2+2+1+2), hint=2, localOffset=2
        // Backspace should delete 'd', then 'c', then chiclet c1
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const raw = `ab{${JSON.stringify(p1)}}cd{${JSON.stringify(p2)}}ef`;
        const model = EditorModel.fromRawValue(raw);

        // First backspace: delete 'd' (localOffset=2, not at edge)
        let offset = model.deleteAtOffset(4, -1, 2);
        assert.equal(offset, 3);
        assert.equal(allText(model), "abcef");
        assert.deepEqual(chicletPaths(model), ["p1", "p2"]);

        // Second backspace: delete 'c' (localOffset=1, still not at edge)
        offset = model.deleteAtOffset(3, -1, 2);
        assert.equal(offset, 2);
        assert.equal(allText(model), "abef");
        assert.deepEqual(chicletPaths(model), ["p1", "p2"]);

        // Third backspace: localOffset=0, now at edge → delete c1
        offset = model.deleteAtOffset(2, -1, 2);
        assert.equal(offset, 2);
        assert.equal(allText(model), "abef");
        assert.deepEqual(chicletPaths(model), ["p2"]);
      });
    });

    describe("gnarly layout and insertion edge cases", () => {
      // These tests exhaustively cover chiclets at the absolute boundaries (start/end),
      // multiple stacked newlines, and complex chiclet movements (drag-and-drop simulation)
      // across lines.

      it("handles chiclet at absolute start (insert and stack)", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const model = EditorModel.empty();

        // 1. Insert first chiclet at absolute start
        model.insertChicletAtOffset(0, p1);
        // Expected: ["", c1, ""]
        assert.equal(model.length, 3);
        assert.ok(isText(model.segmentAt(0)!));
        assert.ok(isChiclet(model.segmentAt(1)!));
        assert.ok(isText(model.segmentAt(2)!));

        // 2. Insert second chiclet before first (afterChiclet = false, hint = 0)
        model.insertChicletAtOffset(0, p2, false, 0);
        // Expected: ["", c2, "", c1, ""]
        assert.equal(model.length, 5);
        assert.equal((model.segmentAt(1) as ChicletSegment).part.path, "p2");
        assert.equal((model.segmentAt(3) as ChicletSegment).part.path, "p1");

        // 3. Insert newline at the very start (offset 0, hint = 0)
        model.insertTextAtOffset(0, "\n", 0);
        // Expected: ["\n", c2, "", c1, ""]
        assert.equal((model.segmentAt(0) as TextSegment).text, "\n");
      });

      it("handles chiclet at absolute end (insert and stack)", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const model = EditorModel.fromRawValue("Hello");

        // 1. Insert first chiclet at absolute end (offset 5, hint = 0)
        model.insertChicletAtOffset(5, p1, false, 0);
        // Expected: ["Hello", c1, ""]
        assert.equal(model.length, 3);
        assert.equal((model.segmentAt(0) as TextSegment).text, "Hello");
        assert.equal((model.segmentAt(1) as ChicletSegment).part.path, "p1");

        // 2. Insert second chiclet after the first one at the end (offset 5, afterChiclet = true, hint = 2)
        model.insertChicletAtOffset(5, p2, true, 2);
        // Expected: ["Hello", c1, "", c2, ""]
        assert.equal(model.length, 5);
        assert.equal((model.segmentAt(1) as ChicletSegment).part.path, "p1");
        assert.equal((model.segmentAt(3) as ChicletSegment).part.path, "p2");
      });

      it("handles chiclets surrounded by multiple newlines", () => {
        // Model: \n\n{p1}\n\n
        // Segments: ["\n\n", c1, "\n\n"]
        const p1 = makePart({ path: "p1" });
        const raw = `\n\n{${JSON.stringify(p1)}}\n\n`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.length, 3);

        // 1. Insert text in the first double-newline segment at offset 1 (between the two newlines)
        // charOffset = 1, hint = 0
        model.insertTextAtOffset(1, "A", 0);
        // Expected: ["\nA\n", c1, "\n\n"]
        assert.equal((model.segmentAt(0) as TextSegment).text, "\nA\n");

        // 2. Backspace from the second double-newline segment (hint = 2)
        // charOffset: "\nA\n" (3) + "\n\n" (2) = 5.
        // We backspace at offset 4 (which is inside "\n\n", between the two newlines).
        // localOffset within segment 2: 4 - 3 = 1 (not 0, so should not delete the chiclet).
        const newOffset = model.deleteAtOffset(4, -1, 2);
        // Should delete one newline from the trailing "\n\n".
        assert.equal(newOffset, 3);
        assert.equal((model.segmentAt(2) as TextSegment).text, "\n");
        // Chiclet should still be there.
        assert.equal(model.length, 3);
        assert.equal((model.segmentAt(1) as ChicletSegment).part.path, "p1");
      });

      it("moves a chiclet over newlines (drag and drop simulation)", () => {
        // Setup: ["text\n", c1, "\nother"]
        const p1 = makePart({ path: "p1" });
        const raw = `text\n{${JSON.stringify(p1)}}\nother`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.length, 3);

        // Scenario A: Drag c1 to the end of "text" (before the first newline)
        // Target segment = 0, offset = 4.
        const modelA = EditorModel.fromRawValue(raw);
        // c1 is at index 1.
        modelA.moveChicletToSegmentOffset(1, 0, 4);
        // Expected segments after move:
        // Before split: "text\n" -> split at 4 -> "text", "\n"
        // Insert c1: "text", c1, "\n"
        // The remaining segments: "\nother" (spliced out from index 1, which was c1)
        // Combined: ["text", c1, "\n", "\nother"] -> merge: ["text", c1, "\n\nother"]
        assert.equal(modelA.length, 3);
        assert.ok(isText(modelA.segmentAt(0)!));
        assert.equal((modelA.segmentAt(0) as TextSegment).text, "text");
        assert.ok(isChiclet(modelA.segmentAt(1)!));
        assert.equal((modelA.segmentAt(2) as TextSegment).text, "\n\nother");

        // Scenario B: Drag c1 to the start of "other" (after the second newline)
        // Target segment = 2, offset = 1 (after the "\n" in "\nother").
        const modelB = EditorModel.fromRawValue(raw);
        modelB.moveChicletToSegmentOffset(1, 2, 1);
        // Target segment was index 2 ("\nother").
        // Since T (2) > S (1), adjustedTargetIndex = 2 - 2 = 0.
        // Wait, why did the adjustedTargetIndex become 0 in the model?
        // Let's look at the model's index adjustment:
        // If targetSegmentIndex > fromIndex:
        //   adjustedTargetIndex = targetSegmentIndex - 2;
        // Why -2? Because removing the chiclet at fromIndex (index 1) shifts all subsequent
        // segments left by 1. Also, the chiclet was surrounded by text, so removing it
        // merges the preceding and succeeding text segments (which reduces the length by another 1).
        // So targetSegmentIndex 2 becomes 0 (which is the newly merged single text segment "text\n\nother").
        // Let's verify:
        // original segments: ["text\n", c1, "\nother"]
        // splice out c1: ["text\n", "\nother"]
        // merge adjacent: ["text\n\nother"] (length 1)
        // Since target segment was index 2, and we shifted by 2, adjustedTargetIndex = 0.
        // Local offset: T > S + 1 is false (T=2, S=1 -> T === S + 1 is true!).
        // If T === S + 1:
        //   adjustedLocalOffset = prevTextSeg.text.length + localOffset
        //   where prevTextSeg was the segment at S-1 ("text\n", length 5).
        //   So adjustedLocalOffset = 5 + 1 = 6.
        // So we split the merged segment "text\n\nother" at offset 6 (which is right after the second newline: "text\n\n" | "other").
        // Result: ["text\n\n", c1, "other"]
        assert.equal(modelB.length, 3);
        assert.equal((modelB.segmentAt(0) as TextSegment).text, "text\n\n");
        assert.ok(isChiclet(modelB.segmentAt(1)!));
        assert.equal((modelB.segmentAt(2) as TextSegment).text, "other");
      });

      it("moves a chiclet in a stacked layout on separate lines", () => {
        // Setup:
        // \n{c1}{c2}\n{c3}{c4}
        // Segments: ["\n", c1, "", c2, "\n", c3, "", c4, ""] (length 9)
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const p3 = makePart({ path: "p3" });
        const p4 = makePart({ path: "p4" });
        const raw = `\n{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}\n{${JSON.stringify(p3)}}{${JSON.stringify(p4)}}`;
        const model = EditorModel.fromRawValue(raw);
        assert.equal(model.length, 9);

        // Move c3 (index 5) to target segment index 2 (the empty text segment between c1 and c2).
        // localOffset = 0.
        model.moveChicletToSegmentOffset(5, 2, 0);

        // Result should have:
        // c1 (p1), c3 (p3), c2 (p2) on first line.
        // c4 (p4) on second line.
        // Let's verify the paths in order.
        const paths: string[] = [];
        for (let i = 0; i < model.length; i++) {
          const seg = model.segmentAt(i)!;
          if (isChiclet(seg)) paths.push(seg.part.path);
        }
        assert.deepEqual(paths, ["p1", "p3", "p2", "p4"]);

        // Let's verify that the alternating invariant holds (every second segment is text, starting and ending with text).
        assert.equal(model.length, 9); // ["\n", c1, "", c3, "", c2, "\n", c4, ""]
        assert.ok(isText(model.segmentAt(0)!));
        assert.ok(isChiclet(model.segmentAt(1)!));
        assert.ok(isText(model.segmentAt(2)!));
        assert.ok(isChiclet(model.segmentAt(3)!));
        assert.ok(isText(model.segmentAt(4)!));
        assert.ok(isChiclet(model.segmentAt(5)!));
        assert.ok(isText(model.segmentAt(6)!));
        assert.ok(isChiclet(model.segmentAt(7)!));
        assert.ok(isText(model.segmentAt(8)!));
      });
    });

    describe("weird typing and deletion boundaries between chiclets", () => {
      // These tests simulate actual keyboard inputs (typing text, spaces, hitting Enter)
      // and deletion flows at the boundaries between multiple chiclets.

      // --- typing / inserting newlines ---

      it("inserts newline before the first chiclet (leading)", () => {
        const p1 = makePart({ path: "p1" });
        const model = EditorModel.empty();
        model.insertChicletAtOffset(0, p1); // ["", c1, ""]

        // Press Enter at the very start (charOffset = 0, segmentHint = 0)
        model.insertTextAtOffset(0, "\n", 0);
        // Expected segments: ["\n", c1, ""]
        assert.equal(model.length, 3);
        assert.equal((model.segmentAt(0) as TextSegment).text, "\n");

        // Expected render segments: ["\n\uFEFF", c1, "\uFEFF\n\n"]
        // Wait! The last segment is "" which does not end with \n. But the first segment ends with \n.
        // Wait, does toRenderSegments append extra newline to the FIRST segment if it ends with \n?
        // No, only to the LAST result segment if it ends with \n.
        // So expected render segments: ["\n\uFEFF", c1, "\uFEFF"]
        const renderSegs = model.toRenderSegments();
        assert.equal((renderSegs[0] as TextSegment).text, `\n${ZWNBSP}`);
        assert.equal((renderSegs[2] as TextSegment).text, ZWNBSP);
      });

      it("inserts newline between two chiclets", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const model = EditorModel.empty();
        model.insertChicletAtOffset(0, p1);
        model.insertChicletAtOffset(0, p2, true); // ["", c1, "", c2, ""]

        // Press Enter between c1 and c2 (charOffset = 0, segmentHint = 2)
        model.insertTextAtOffset(0, "\n", 2);
        // Expected segments: ["", c1, "\n", c2, ""]
        assert.equal(model.length, 5);
        assert.equal((model.segmentAt(2) as TextSegment).text, "\n");

        // Expected render segments: ["\uFEFF", c1, "\uFEFF\n\uFEFF", c2, "\uFEFF"]
        const renderSegs = model.toRenderSegments();
        assert.equal(
          (renderSegs[2] as TextSegment).text,
          `${ZWNBSP}\n${ZWNBSP}`
        );
      });

      it("inserts newline after the last chiclet (trailing)", () => {
        const p1 = makePart({ path: "p1" });
        const model = EditorModel.empty();
        model.insertChicletAtOffset(0, p1); // ["", c1, ""]

        // Press Enter after c1 (charOffset = 0, segmentHint = 2)
        model.insertTextAtOffset(0, "\n", 2);
        // Expected segments: ["", c1, "\n"]
        assert.equal(model.length, 3);
        assert.equal((model.segmentAt(2) as TextSegment).text, "\n");

        // Expected render segments: ["\uFEFF", c1, "\uFEFF\n\n"] (with sentinel newline!)
        const renderSegs = model.toRenderSegments();
        assert.equal((renderSegs[2] as TextSegment).text, `${ZWNBSP}\n\n`);
      });

      // --- typing spaces and text ---

      it("types a space before the first chiclet", () => {
        const p1 = makePart({ path: "p1" });
        const model = EditorModel.empty();
        model.insertChicletAtOffset(0, p1); // ["", c1, ""]

        model.insertTextAtOffset(0, " ", 0);
        // Expected segments: [" ", c1, ""]
        assert.equal((model.segmentAt(0) as TextSegment).text, " ");
      });

      it("types a space between two chiclets", () => {
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const model = EditorModel.empty();
        model.insertChicletAtOffset(0, p1);
        model.insertChicletAtOffset(0, p2, true); // ["", c1, "", c2, ""]

        model.insertTextAtOffset(0, " ", 2);
        // Expected segments: ["", c1, " ", c2, ""]
        assert.equal((model.segmentAt(2) as TextSegment).text, " ");
      });

      it("types a space after the last chiclet", () => {
        const p1 = makePart({ path: "p1" });
        const model = EditorModel.empty();
        model.insertChicletAtOffset(0, p1); // ["", c1, ""]

        model.insertTextAtOffset(0, " ", 2);
        // Expected segments: ["", c1, " "]
        assert.equal((model.segmentAt(2) as TextSegment).text, " ");
      });

      // --- deletions at boundaries ---

      it("backspaces when cursor is between two chiclets containing a single character", () => {
        // Model: ["", c1, "A", c2, ""]
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const raw = `{${JSON.stringify(p1)}}A{${JSON.stringify(p2)}}`;

        // Scenario 1: Cursor is after "A". charOffset = 1, segmentHint = 2.
        // We press backspace (count = -1).
        // localOffset inside segment 2 is 1 (since runningOffset before index 2 is 0).
        // Since localOffset (1) !== 0, it should delete the character "A", not the chiclet c1.
        const model1 = EditorModel.fromRawValue(raw);
        let newOffset = model1.deleteAtOffset(1, -1, 2);
        assert.equal(newOffset, 0);
        // Expected segments: ["", c1, "", c2, ""]
        assert.equal(model1.length, 5);
        assert.equal((model1.segmentAt(2) as TextSegment).text, "");
        // Both chiclets are still there.
        const paths1 = [];
        for (let i = 0; i < model1.length; i++) {
          const seg = model1.segmentAt(i)!;
          if (isChiclet(seg)) paths1.push(seg.part.path);
        }
        assert.deepEqual(paths1, ["p1", "p2"]);

        // Scenario 2: Cursor is before "A". charOffset = 0, segmentHint = 2.
        // We press backspace (count = -1).
        // localOffset inside segment 2 is 0.
        // Since localOffset (0) === 0, it should delete the preceding chiclet c1.
        const model2 = EditorModel.fromRawValue(raw);
        newOffset = model2.deleteAtOffset(0, -1, 2);
        assert.equal(newOffset, 0);
        // Expected segments: ["A", c2, ""]
        assert.equal(model2.length, 3);
        assert.equal((model2.segmentAt(0) as TextSegment).text, "A");
        const paths2 = [];
        for (let i = 0; i < model2.length; i++) {
          const seg = model2.segmentAt(i)!;
          if (isChiclet(seg)) paths2.push(seg.part.path);
        }
        assert.deepEqual(paths2, ["p2"]);
      });

      it("forward deletes when cursor is between two chiclets containing a single character", () => {
        // Model: ["", c1, "A", c2, ""]
        const p1 = makePart({ path: "p1" });
        const p2 = makePart({ path: "p2" });
        const raw = `{${JSON.stringify(p1)}}A{${JSON.stringify(p2)}}`;

        // Scenario 1: Cursor is before "A". charOffset = 0, segmentHint = 2.
        // We press delete (count = 1).
        // localOffset inside segment 2 is 0.
        // Since localOffset (0) !== text.length (1), it should delete the character "A", not the chiclet c2.
        const model1 = EditorModel.fromRawValue(raw);
        let newOffset = model1.deleteAtOffset(0, 1, 2);
        assert.equal(newOffset, 0);
        // Expected segments: ["", c1, "", c2, ""]
        assert.equal(model1.length, 5);
        assert.equal((model1.segmentAt(2) as TextSegment).text, "");
        const paths1 = [];
        for (let i = 0; i < model1.length; i++) {
          const seg = model1.segmentAt(i)!;
          if (isChiclet(seg)) paths1.push(seg.part.path);
        }
        assert.deepEqual(paths1, ["p1", "p2"]);

        // Scenario 2: Cursor is after "A". charOffset = 1, segmentHint = 2.
        // We press delete (count = 1).
        // localOffset inside segment 2 is 1.
        // Since localOffset (1) === text.length (1), it should delete the succeeding chiclet c2.
        const model2 = EditorModel.fromRawValue(raw);
        newOffset = model2.deleteAtOffset(1, 1, 2);
        assert.equal(newOffset, 1);
        // Expected segments: ["", c1, "A"]
        assert.equal(model2.length, 3);
        assert.equal((model2.segmentAt(2) as TextSegment).text, "A");
        const paths2 = [];
        for (let i = 0; i < model2.length; i++) {
          const seg = model2.segmentAt(i)!;
          if (isChiclet(seg)) paths2.push(seg.part.path);
        }
        assert.deepEqual(paths2, ["p1"]);
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

    it("preserves cursor offset when undoing a paste", () => {
      // Simulate: type "Add a node" (debounced snapshot), then paste
      // "node" at the end → "Add a nodenode", then undo.
      // Cursor should return to offset 10 (end of "Add a node"), NOT 0.
      const model = EditorModel.fromRawValue("");

      // Simulate typing "Add a node" — insert text and capture snapshot.
      model.insertTextAtOffset(0, "Add a node");
      // This simulates the debounced snapshot being flushed.
      model.pushSnapshot(10);

      assert.equal(model.toRawValue(), "Add a node");

      // Simulate #pasteText: push pre-paste snapshot, then mutate.
      model.pushSnapshot(10); // pre-paste cursor position
      model.replaceAll("Add a nodenode", /* resetHistory */ false);
      model.pushSnapshot(14); // post-paste cursor position

      assert.equal(model.toRawValue(), "Add a nodenode");

      // Undo should restore "Add a node" with cursorOffset=10.
      const result = model.undo();
      assert.ok(result);
      assert.equal(model.toRawValue(), "Add a node");
      assert.equal(
        result!.cursorOffset,
        10,
        "Cursor should be at end of 'Add a node', not 0"
      );
    });

    it("preserves cursor offset when undoing a paste after external value set", () => {
      // Simulate: parent sets value via property (replaceAll with reset),
      // user places cursor at end, then pastes "node".
      // This is the exact scenario that was broken: replaceAll seeds
      // history with cursorOffset: 0, so without a pre-paste snapshot
      // the cursor reverts to 0 on undo.
      const model = EditorModel.fromRawValue("Add any node");
      // ^ This seeds history[0] = { "Add any node", cursorOffset: 0 }

      // Simulate #pasteText: push pre-paste snapshot at cursor position 12.
      model.pushSnapshot(12);
      model.replaceAll("Add any nodenode", /* resetHistory */ false);
      model.pushSnapshot(16); // cursor at end of pasted content

      assert.equal(model.toRawValue(), "Add any nodenode");

      // Undo should restore "Add any node" with cursorOffset=12.
      const result = model.undo();
      assert.ok(result);
      assert.equal(model.toRawValue(), "Add any node");
      assert.equal(
        result!.cursorOffset,
        12,
        "Cursor should be at end of 'Add any node' (12), not 0"
      );
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

    it("deletes a range including a chiclet (trailing)", () => {
      const part = makePart({ path: "p1" });
      const model = EditorModel.fromRawValue("Hello");
      model.insertChicletAtOffset(5, part);
      model.insertTextAtOffset(5, " world");

      // Verify setup: ["Hello", chiclet, " world"]
      assert.equal(model.visibleTextLength, 11);

      // Delete from 5 to 11 — should remove " world" and the chiclet.
      const newOffset = model.deleteSelection(5, 11);
      assert.equal(newOffset, 5);
      assert.equal(model.toRawValue(), "Hello");
      assert.equal(model.length, 1);
      assert.equal((model.segmentAt(0) as TextSegment).text, "Hello");
    });

    it("deletes a selection spanning multiple chiclets and merges text segments", () => {
      const p1 = makePart({ path: "p1" });
      const p2 = makePart({ path: "p2" });
      const model = EditorModel.fromRawValue("Hello ");
      model.insertChicletAtOffset(6, p1);
      model.insertChicletAtOffset(6, p2, true); // ["Hello ", c1, "", c2, ""]
      model.insertTextAtOffset(6, " world", 2); // ["Hello ", c1, " world", c2, ""]

      // Visible structure: "Hello " (len 6) + " world" (len 6) = 12 visible chars.
      // c1 is at offset 6. c2 is at offset 12.
      // Let's verify setup:
      assert.equal(model.visibleTextLength, 12);

      // Delete selection from 4 to 8 (spans "o" in "Hello ", c1, and " w" in " world").
      // Expected remaining: "Hell" + "orld" = "Hellorld".
      // c1 should be deleted because it is strictly within the deleted range [4, 8].
      // c2 is at offset 12 (outside), so it should stay.
      const newOffset = model.deleteSelection(4, 8);
      assert.equal(newOffset, 4);

      // Expected raw value: "Hellorld" + c2
      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["p2"]);
      assert.equal(model.visibleTextLength, 8); // "Hellorld"
      assert.equal((model.segmentAt(0) as TextSegment).text, "Hellorld");
    });

    it("preserves chiclet at boundary with exclusive deletion", () => {
      // Simulate: ["", chicletA, "@"] — chiclet at offset 0, "@" is the
      // only visible text. Exclusive delete of [0,1] should remove "@"
      // but leave chicletA intact.
      const partA = makePart({ path: "A", title: "Node A" });
      const model = EditorModel.empty();
      model.insertChicletAtOffset(0, partA);
      model.insertTextAtOffset(0, "@"); // Goes after chiclet

      // Verify setup: ["", chicletA, "@"]
      assert.equal(model.visibleTextLength, 1);
      assert.equal(model.hasChicletAtBoundary(0), true);

      // Exclusive delete: should remove "@" but NOT the chiclet.
      const newOffset = model.deleteSelection(0, 1, false);
      assert.equal(newOffset, 0);
      assert.equal(model.visibleTextLength, 0);

      // ChicletA must still be present.
      let foundChiclet = false;
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg) && seg.part.path === "A") {
          foundChiclet = true;
        }
      }
      assert.ok(foundChiclet, "chicletA should still be in the model");
    });

    it("inclusive delete removes chiclet at boundary", () => {
      // Same setup but with inclusive=true (default): the chiclet at
      // offset 0 should be included in the delete range [0,1].
      const partA = makePart({ path: "A", title: "Node A" });
      const model = EditorModel.empty();
      model.insertChicletAtOffset(0, partA);
      model.insertTextAtOffset(0, "@");

      const newOffset = model.deleteSelection(0, 1, true);
      assert.equal(newOffset, 0);

      // Both chiclet and "@" should be gone.
      let foundChiclet = false;
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) foundChiclet = true;
      }
      assert.ok(!foundChiclet, "chicletA should be removed with inclusive");
    });

    it("consecutive fast-access insertions preserve both chiclets in order", () => {
      // Full scenario: blank editor → insert chicletA → type "@" →
      // exclusive-delete "@" → insert chicletB after chicletA → [A, B].
      const partA = makePart({ path: "A", title: "Node A" });
      const partB = makePart({ path: "B", title: "Node B" });

      const model = EditorModel.empty();

      // 1. Insert chicletA at offset 0.
      model.insertChicletAtOffset(0, partA);
      // Model: ["", chicletA, ""]

      // 2. Type "@" after chicletA.
      model.insertTextAtOffset(0, "@");
      // Model: ["", chicletA, "@"]

      // 3. Exclusive-delete the "@" (simulating addItem's range deletion).
      model.deleteSelection(0, 1, false);
      // Model: ["", chicletA, ""]

      // 4. Insert chicletB after chicletA (afterChiclet=true because
      //    hasChicletAtBoundary(0) is true — addItem detects this).
      const afterChiclet = model.hasChicletAtBoundary(0);
      assert.ok(afterChiclet, "chicletA should be at boundary 0");
      model.insertChicletAtOffset(0, partB, afterChiclet);
      // Model: ["", chicletA, "", chicletB, ""]

      // Both chiclets should be present in insertion order: A then B.
      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["A", "B"]);
    });
  });

  describe("insertChicletAtOffset with afterChiclet", () => {
    it("inserts after an existing chiclet at offset 0", () => {
      const partA = makePart({ path: "A" });
      const partB = makePart({ path: "B" });
      const model = EditorModel.empty();
      model.insertChicletAtOffset(0, partA);
      // Model: ["", chicletA, ""]

      model.insertChicletAtOffset(0, partB, true);
      // Model: ["", chicletA, "", chicletB, ""]

      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["A", "B"]);
    });

    it("inserts before when afterChiclet is false (default)", () => {
      const partA = makePart({ path: "A" });
      const partB = makePart({ path: "B" });
      const model = EditorModel.empty();
      model.insertChicletAtOffset(0, partA);

      model.insertChicletAtOffset(0, partB, false);
      // Model: ["", chicletB, "", chicletA, ""]

      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["B", "A"]);
    });
  });

  describe("insertChicletAtOffset with segmentHint (adjacent chiclets)", () => {
    it("inserts third chiclet at the end when hint targets trailing segment", () => {
      // Simulate: user typed text, then @ x3 to add three chiclets.
      // After two insertions: ["text", c1, "", c2, ""] (5 segments).
      const partA = makePart({ path: "A" });
      const partB = makePart({ path: "B" });
      const partC = makePart({ path: "C" });
      const model = EditorModel.fromRawValue("text");
      model.insertChicletAtOffset(4, partA);
      model.insertChicletAtOffset(4, partB, true);

      // Model: ["text", c_A, "", c_B, ""]
      assert.equal(model.length, 5);

      // Insert third chiclet at offset 4 with segmentHint=4 (trailing "").
      // Without hint, this would insert between A and B (afterChiclet
      // only skips one chiclet).
      model.insertChicletAtOffset(4, partC, true, 4);

      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["A", "B", "C"]);
    });

    it("inserts chiclet between two existing ones when hint targets middle segment", () => {
      // After two insertions: ["text", c_A, "", c_B, ""] (5 segments).
      const partA = makePart({ path: "A" });
      const partB = makePart({ path: "B" });
      const partC = makePart({ path: "C" });
      const model = EditorModel.fromRawValue("text");
      model.insertChicletAtOffset(4, partA);
      model.insertChicletAtOffset(4, partB, true);

      // Insert at offset 4 with segmentHint=2 (empty text between A and B).
      model.insertChicletAtOffset(4, partC, false, 2);

      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["A", "C", "B"]);
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
  // shouldPlaceCursorAfterChiclet
  // ---------------------------------------------------------------------------

  describe("shouldPlaceCursorAfterChiclet", () => {
    it("handles basic chiclet boundary with segmentHint", () => {
      const p1 = makePart({ path: "p1" });
      const raw = `Hello{${JSON.stringify(p1)}} world`;
      const model = EditorModel.fromRawValue(raw);

      // Segments: ["Hello", c1, " world"] (indices: 0, 1, 2)
      // Offset 5 is at the boundary of c1.

      // If cursor is in segment 0 ("Hello"), it is before c1.
      assert.equal(model.shouldPlaceCursorAfterChiclet(5, 0), false);

      // If cursor is in segment 2 (" world"), it is after c1.
      assert.equal(model.shouldPlaceCursorAfterChiclet(5, 2), true);

      // Fallback without hint scans left to right, matching the first segment at offset 5 (segment 0).
      assert.equal(model.shouldPlaceCursorAfterChiclet(5), false);
    });

    it("handles adjacent chiclets with segmentHint", () => {
      const p1 = makePart({ path: "p1" });
      const p2 = makePart({ path: "p2" });
      const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}`;
      const model = EditorModel.fromRawValue(raw);

      // Segments: ["", c1, "", c2, ""] (indices: 0, 1, 2, 3, 4)
      // Both c1 and c2 share visible offset 0.

      // If cursor is in segment 0 (before c1), return false.
      assert.equal(model.shouldPlaceCursorAfterChiclet(0, 0), false);

      // If cursor is in segment 2 (after c1, before c2), return true (after c1).
      assert.equal(model.shouldPlaceCursorAfterChiclet(0, 2), true);

      // If cursor is in segment 4 (after c2), return true (after c2).
      assert.equal(model.shouldPlaceCursorAfterChiclet(0, 4), true);
    });

    it("matches Paul's exact regression case (multi-space backspace)", () => {
      const p1 = makePart({ path: "p1" });
      const p2 = makePart({ path: "p2" });
      const p3 = makePart({ path: "p3" });

      // Raw string: "I have these assets: {c1}{c2}  {c3}"
      const raw = `I have these assets: {${JSON.stringify(p1)}}{${JSON.stringify(p2)}}  {${JSON.stringify(p3)}}`;
      const model = EditorModel.fromRawValue(raw);

      // Initial segments (length 7):
      // 0: "I have these assets: " (len 21)
      // 1: c1 (p1)
      // 2: "" (len 0)
      // 3: c2 (p2)
      // 4: "  " (len 2)
      // 5: c3 (p3)
      // 6: "" (len 0)
      assert.equal(model.length, 7);

      // --- 1. Backspace once ---
      // We simulate backspacing once at the end of the spaces (offset 23).
      // Segment 4 becomes " " (len 1).
      model.deleteAtOffset(23, -1, 4);
      assert.equal((model.segmentAt(4) as TextSegment).text, " ");

      // New cursor offset is 22, in segment 4.
      // Since it is at localOffset = 1 (before c3), shouldPlaceCursorAfterChiclet must return FALSE.
      assert.equal(model.shouldPlaceCursorAfterChiclet(22, 4), false);

      // --- 2. Backspace second space ---
      // We simulate backspacing again (offset 22).
      // Segment 4 becomes "" (len 0).
      model.deleteAtOffset(22, -1, 4);
      assert.equal((model.segmentAt(4) as TextSegment).text, "");

      // New cursor offset is 21, in segment 4.
      // Since it is at localOffset = 0 of segment 4 (which is immediately after c2),
      // shouldPlaceCursorAfterChiclet must return TRUE.
      assert.equal(model.shouldPlaceCursorAfterChiclet(21, 4), true);
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

  describe("moveChicletToSegmentOffset", () => {
    it("moves the penultimate chiclet to the end (resolves the zero-width end drag bug)", () => {
      const model = EditorModel.fromRawValue("");
      const partA = makePart({ path: "A" });
      const partB = makePart({ path: "B" });
      model.insertChicletAtOffset(0, partA);
      model.insertChicletAtOffset(0, partB, true);

      // Setup: ["", chicletA, "", chicletB, ""]
      // penult (A) is at index 1. B is at index 3.
      // Target segment is 4 (the trailing empty text segment).
      const { newOffset, afterChiclet } = model.moveChicletToSegmentOffset(
        1,
        4,
        0
      );

      // Result should be: ["", chicletB, "", chicletA, ""]
      assert.equal(model.length, 5);
      const first = model.segmentAt(1)!;
      const second = model.segmentAt(3)!;
      assert.ok(isChiclet(first) && first.part.path === "B");
      assert.ok(isChiclet(second) && second.part.path === "A");
      assert.equal(newOffset, 0);
      assert.equal(afterChiclet, true);
    });

    it("moves a chiclet to a preceding text segment", () => {
      // Setup: ["Hello ", chicletA, " mid ", chicletB, " world"]
      const partA = makePart({ path: "A" });
      const partB = makePart({ path: "B" });
      const model = EditorModel.fromRawValue("Hello  mid  world");
      model.insertChicletAtOffset(6, partA);
      model.insertChicletAtOffset(11, partB);

      // Source is chiclet B (index 3).
      // Target is the first text segment (index 0), offset 5 (after "Hello").
      model.moveChicletToSegmentOffset(3, 0, 5);

      // Result: ["Hello", chicletB, " ", chicletA, " mid  world"]
      // After merging, index 0 is split: ["Hello", chicletB, "  mid  world"]
      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["B", "A"]);
    });

    it("moves a chiclet to a succeeding text segment adjusting offset for merge", () => {
      // Setup: ["Hello ", chicletA, " world"] (A at index 1)
      const partA = makePart({ path: "A" });
      const model = EditorModel.fromRawValue("Hello  world");
      model.insertChicletAtOffset(6, partA);

      // Target is index 2 (the text segment " world" after A), offset 1 (between space and "w").
      // Since T (2) > S (1) and T is the immediate next segment (T === S + 1),
      // the offset should be adjusted: "Hello " (6 chars) + offset (1) = 7.
      model.moveChicletToSegmentOffset(1, 2, 1);

      // Result: ["Hello  world" split at 7 -> "Hello  ", chicletA, "world"]
      const seg0 = model.segmentAt(0)!;
      assert.ok(isText(seg0));
      assert.equal(seg0.text, "Hello  ");
      const seg2 = model.segmentAt(2)!;
      assert.ok(isText(seg2));
      assert.equal(seg2.text, "world");
    });

    it("redirects chiclet target to adjacent text segment (drag onto chiclet)", () => {
      // Setup: ["", c1, "", c2, "", c3, ""]
      const p1 = makePart({ path: "p1" });
      const p2 = makePart({ path: "p2" });
      const p3 = makePart({ path: "p3" });
      const raw = `{${JSON.stringify(p1)}}{${JSON.stringify(p2)}}{${JSON.stringify(p3)}}`;
      const model = EditorModel.fromRawValue(raw);
      assert.equal(model.length, 7, "sanity: 7 alternating segments");

      // Try to move c1 (index 1) to target segment 3 (c2) — this is what
      // happens when caretPositionFromPoint lands inside c2's DOM.
      // Should redirect to segment 4 (text after c2), offset 0.
      const { afterChiclet } = model.moveChicletToSegmentOffset(1, 3, 0);
      assert.equal(afterChiclet, true);

      // c1 should now be between c2 and c3.
      const paths: string[] = [];
      for (let i = 0; i < model.length; i++) {
        const seg = model.segmentAt(i)!;
        if (isChiclet(seg)) paths.push(seg.part.path);
      }
      assert.deepEqual(paths, ["p2", "p1", "p3"]);
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
