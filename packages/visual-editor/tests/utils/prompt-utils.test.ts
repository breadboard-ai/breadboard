/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePrompt,
  buildPrompt,
  extractPromptText,
  extractInPorts,
  promptToBlocks,
  blocksToPrompt,
  type PromptBlock,
} from "../../src/utils/prompt-utils.js";
import type { TemplatePart } from "@breadboard-ai/utils";
import type { LLMContent } from "@breadboard-ai/types";

describe("prompt-utils", () => {
  describe("parsePrompt", () => {
    it("splits raw prompt into objective text and tools", () => {
      const tool1: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const tool2: TemplatePart = {
        type: "tool",
        path: "tool-2",
        title: "Tool 2",
      };
      const raw = `Solve the objective.
{${JSON.stringify(tool1)}}
{${JSON.stringify(tool2)}}`;

      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(objectiveText, "Solve the objective.");
      assert.deepEqual(tools, [tool1, tool2]);
    });

    it("preserves non-tool placeholders in objective text", () => {
      const inPort: TemplatePart = {
        type: "in",
        path: "input-val",
        title: "Input Val",
      };
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const raw = `Use input {${JSON.stringify(inPort)}} to run {${JSON.stringify(tool)}}`;

      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(
        objectiveText,
        `Use input {${JSON.stringify(inPort)}} to run`
      );
      assert.deepEqual(tools, [tool]);
    });

    it("handles legacy prompts with tools interspersed", () => {
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const raw = `Before {${JSON.stringify(tool)}} After`;

      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(objectiveText, "Before  After");
      assert.deepEqual(tools, [tool]);
    });

    it("handles prompts with no tools", () => {
      const raw = "Plain objective text";
      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(objectiveText, "Plain objective text");
      assert.deepEqual(tools, []);
    });

    it("handles invalid JSON placeholders gracefully", () => {
      const raw = "Objective with invalid placeholder {{invalid-json}}";
      const { objectiveText, tools } = parsePrompt(raw);

      assert.strictEqual(
        objectiveText,
        "Objective with invalid placeholder {{invalid-json}}"
      );
      assert.deepEqual(tools, []);
    });
  });

  describe("buildPrompt", () => {
    it("appends tool placeholders at the end of the prompt", () => {
      const objectiveText = "Solve the objective.";
      const tools: TemplatePart[] = [
        { type: "tool", path: "tool-1", title: "Tool 1" },
      ];

      const prompt = buildPrompt(objectiveText, tools);

      assert.strictEqual(
        prompt,
        `Solve the objective.\n{{"type":"tool","path":"tool-1","title":"Tool 1"}}`
      );
    });

    it("returns tools only if objective text is empty", () => {
      const objectiveText = "";
      const tools: TemplatePart[] = [
        { type: "tool", path: "tool-1", title: "Tool 1" },
      ];

      const prompt = buildPrompt(objectiveText, tools);

      assert.strictEqual(
        prompt,
        `{{"type":"tool","path":"tool-1","title":"Tool 1"}}`
      );
    });

    it("returns objective text only if tools list is empty", () => {
      const objectiveText = "Solve the objective.";
      const tools: TemplatePart[] = [];

      const prompt = buildPrompt(objectiveText, tools);

      assert.strictEqual(prompt, "Solve the objective.");
    });
  });

  describe("extractPromptText", () => {
    it("extracts text from user parts in LLMContent value", () => {
      const config = {
        role: "user",
        parts: [{ text: "Objective text" }],
      };

      assert.strictEqual(extractPromptText(config), "Objective text");
    });

    it("returns empty string for invalid prompt values", () => {
      assert.strictEqual(extractPromptText(null), "");
      assert.strictEqual(extractPromptText(undefined), "");
      assert.strictEqual(extractPromptText("plain text"), "");
      assert.strictEqual(extractPromptText({ parts: [] }), "");
    });
  });

  describe("extractInPorts", () => {
    it("extracts inport references from prompt string", () => {
      const inPort: TemplatePart = {
        type: "in",
        path: "input-val",
        title: "Input Val",
      };
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-1",
        title: "Tool 1",
      };
      const prompt = `Use input {${JSON.stringify(inPort)}} and tool {${JSON.stringify(tool)}}`;

      const ins = extractInPorts(prompt);

      assert.deepEqual(ins, [{ path: "input-val", title: "Input Val" }]);
    });

    it("returns empty array when no inports are present", () => {
      assert.deepEqual(extractInPorts("Plain prompt without inports"), []);
    });
  });

  describe("promptToBlocks", () => {
    it("handles null / undefined / invalid inputs", () => {
      assert.deepEqual(promptToBlocks(null), []);
      assert.deepEqual(promptToBlocks(undefined), []);
      assert.deepEqual(promptToBlocks("plain text string"), []);
      assert.deepEqual(promptToBlocks({ parts: [] }), []);
    });

    it("parses plain text to a single block", () => {
      const prompt = {
        role: "user",
        parts: [{ text: "Hello simple world" }],
      };
      const blocks = promptToBlocks(prompt);
      assert.strictEqual(blocks.length, 1);
      assert.deepEqual(blocks[0], {
        role: "user",
        parts: [{ text: "Hello simple world" }],
      });
    });

    it("splits text with an asset placeholder into separate blocks", () => {
      const asset: TemplatePart = {
        type: "asset",
        path: "draw.png",
        title: "Drawing",
        mimeType: "image/png",
      };
      const prompt = {
        role: "user",
        parts: [{ text: `Before {${JSON.stringify(asset)}} After` }],
      };

      const blocks = promptToBlocks(prompt);
      assert.strictEqual(blocks.length, 3);

      assert.deepEqual(blocks[0], {
        role: "user",
        parts: [{ text: "Before " }],
      });

      // Asset block should have the storedData structure and decorate with originalPart
      assert.deepEqual(blocks[1].parts, [
        {
          storedData: {
            handle: "draw.png",
            mimeType: "image/png",
          },
        },
      ]);
      assert.deepEqual((blocks[1] as PromptBlock).originalPart, asset);

      assert.deepEqual(blocks[2], {
        role: "user",
        parts: [{ text: " After" }],
      });
    });

    it("preserves other placeholders (tools) as empty text blocks decorated with originalPart", () => {
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-url",
        title: "My Tool",
      };
      const prompt = {
        role: "user",
        parts: [{ text: `Text {${JSON.stringify(tool)}}` }],
      };

      const blocks = promptToBlocks(prompt);
      assert.strictEqual(blocks.length, 2);
      assert.deepEqual(blocks[0], {
        role: "user",
        parts: [{ text: "Text " }],
      });
      assert.deepEqual(blocks[1].parts, [{ text: "" }]);
      assert.deepEqual((blocks[1] as PromptBlock).originalPart, tool);
    });

    it("handles malformed JSON placeholders as text", () => {
      const prompt = {
        role: "user",
        parts: [{ text: "Text {{invalid-json}} End" }],
      };
      const blocks = promptToBlocks(prompt);
      assert.strictEqual(blocks.length, 1);
      assert.deepEqual(blocks[0], {
        role: "user",
        parts: [{ text: "Text {{invalid-json}} End" }],
      });
    });

    it("maps multi-part input directly to separate blocks", () => {
      const prompt = {
        role: "user",
        parts: [
          { text: "Part 1" },
          { storedData: { handle: "img.png", mimeType: "image/png" } },
        ],
      };
      const blocks = promptToBlocks(prompt);
      assert.strictEqual(blocks.length, 2);
      assert.deepEqual(blocks[0], {
        role: "user",
        parts: [{ text: "Part 1" }],
      });
      assert.deepEqual(blocks[1], {
        role: "user",
        parts: [{ storedData: { handle: "img.png", mimeType: "image/png" } }],
      });
    });
  });

  describe("blocksToPrompt", () => {
    it("handles empty blocks list", () => {
      const prompt = blocksToPrompt([]);
      assert.deepEqual(prompt, { role: "user", parts: [{ text: "" }] });
    });

    it("serializes plain text blocks", () => {
      const blocks = [
        { role: "user", parts: [{ text: "Hello " }] },
        { role: "user", parts: [{ text: "world" }] },
      ];
      const prompt = blocksToPrompt(blocks);
      assert.deepEqual(prompt, {
        role: "user",
        parts: [{ text: "Hello world" }],
      });
    });

    it("serializes decorated originalPart blocks exactly", () => {
      const asset: TemplatePart = {
        type: "asset",
        path: "draw.png",
        title: "Drawing",
        mimeType: "image/png",
      };
      const tool: TemplatePart = {
        type: "tool",
        path: "tool-url",
        title: "My Tool",
      };

      const blocks: LLMContent[] = [
        { role: "user", parts: [{ text: "Before " }] },
        Object.assign(
          {
            role: "user",
            parts: [
              { storedData: { handle: "draw.png", mimeType: "image/png" } },
            ],
          },
          { originalPart: asset }
        ),
        Object.assign(
          { role: "user", parts: [{ text: "" }] },
          { originalPart: tool }
        ),
      ];

      const prompt = blocksToPrompt(blocks);
      assert.deepEqual(prompt, {
        role: "user",
        parts: [
          {
            text: `Before {{"type":"asset","path":"draw.png","title":"Drawing","mimeType":"image/png"}}{{"type":"tool","path":"tool-url","title":"My Tool"}}`,
          },
        ],
      });
    });

    it("serializes newly added asset blocks using default title", () => {
      const blocks = [
        {
          role: "user",
          parts: [
            {
              storedData: { handle: "path/to/img.png", mimeType: "image/png" },
            },
          ],
        },
      ];
      const prompt = blocksToPrompt(blocks);
      assert.deepEqual(prompt, {
        role: "user",
        parts: [
          {
            text: `{{"type":"asset","path":"path/to/img.png","title":"img.png","mimeType":"image/png"}}`,
          },
        ],
      });
    });

    it("maintains perfect round-trip fidelity", () => {
      const originalPrompt = {
        role: "user",
        parts: [
          {
            text: `Here is the prompt {{"type":"asset","path":"draw.png","title":"Drawing","mimeType":"image/png"}} and tool {{"type":"tool","path":"tool-url","title":"My Tool"}} end.`,
          },
        ],
      };

      const blocks = promptToBlocks(originalPrompt);
      const rebuiltPrompt = blocksToPrompt(blocks);

      assert.deepEqual(rebuiltPrompt, originalPrompt);
    });
  });
});
