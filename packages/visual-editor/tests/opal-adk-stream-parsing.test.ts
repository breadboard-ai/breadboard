import { describe, it } from "node:test";
import { strictEqual } from "node:assert";
import { parseStreamChunk } from "../src/a2/a2/opal-adk-stream.js";
import { StreamableReporter } from "../src/a2/a2/output.js";

// Mock StreamableReporter
const mockReporter = {
  sendUpdate: async (title: string, body: any, icon: string) => {
    mockReporter.updates.push({ title, body, icon });
  },
  sendError: async (error: any) => {
    mockReporter.errors.push(error);
    return error;
  },
  updates: [] as any[],
  errors: [] as any[],
} as unknown as StreamableReporter & { updates: any[]; errors: any[] };

describe("parseStreamChunk", () => {
  it("should parse top-level parts with thought", async () => {
    mockReporter.updates = [];
    const chunk = {
      parts: [
        {
          text: "I am thinking",
          partMetadata: { chunk_type: "thought" }
        }
      ]
    };

    const result = await parseStreamChunk(chunk as any, mockReporter, 0);

    strictEqual(result.thoughtCount, 1);
    strictEqual(mockReporter.updates.length, 1);
    strictEqual(mockReporter.updates[0].title, "Thinking (1)");
    strictEqual(mockReporter.updates[0].body, "I am thinking");
  });

  it("should parse nested chunk parts", async () => {
    mockReporter.updates = [];
    const chunk = {
      chunk: {
        parts: [
          {
            text: "Final result",
            partMetadata: { chunk_type: "result" }
          }
        ]
      }
    };

    const result = await parseStreamChunk(chunk as any, mockReporter, 0);

    strictEqual(result.researchResult, "Final result");
    strictEqual(mockReporter.updates.length, 1);
    strictEqual(mockReporter.updates[0].title, "Agent Thought");
  });

  it("should handle snake_case part_metadata", async () => {
    mockReporter.updates = [];
    const chunk = {
      parts: [
        {
          text: "Result with snake case",
          part_metadata: { chunk_type: "research" }
        }
      ]
    };

    const result = await parseStreamChunk(chunk as any, mockReporter, 0);

    strictEqual(result.researchResult, "Result with snake case");
  });

  it("should handle multiple result types (breadboard, html)", async () => {
    mockReporter.updates = [];
    const chunk1 = {
      parts: [{ text: "<html></html>", partMetadata: { chunk_type: "html" } }]
    };
    const chunk2 = {
      parts: [{ text: "{}", partMetadata: { chunk_type: "breadboard" } }]
    };

    const result1 = await parseStreamChunk(chunk1 as any, mockReporter, 0);
    strictEqual(result1.researchResult, "<html></html>");

    const result2 = await parseStreamChunk(chunk2 as any, mockReporter, 0);
    strictEqual(result2.researchResult, "{}");
  });

  it("should handle error chunks", async () => {
    mockReporter.updates = [];
    const chunk = {
      parts: [
        {
          text: "Something went wrong",
          partMetadata: { chunk_type: "error" }
        }
      ]
    };

    const result = await parseStreamChunk(chunk as any, mockReporter, 0);

    strictEqual(result.error, "Generation error: Something went wrong");
  });
});
