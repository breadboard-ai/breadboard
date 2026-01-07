import { describe, it } from "node:test";
import { deepStrictEqual } from "node:assert";
import { collateContexts } from "../../eval/collate-context.js";
import type { Har } from "har-format";
import { DataPart, LLMContent } from "@breadboard-ai/types";
import { GeminiBody } from "../../src/a2/a2/gemini.js";

type MockEntry = {
  startedDateTime?: string;
  time?: number;
  requestContext?: LLMContent[];
  config?: Omit<GeminiBody, "contents">;
  responseParts?: DataPart[];
};

function createMockHar(entries: MockEntry[]): Har {
  return {
    log: {
      version: "1.2",
      creator: { name: "test", version: "1.0" },
      entries: entries.map((entry) => ({
        startedDateTime: entry.startedDateTime || "2024-01-01T00:00:00.000Z",
        time: entry.time || 100,
        request: {
          method: "POST",
          url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
          postData: {
            mimeType: "application/json",
            text: JSON.stringify({
              contents: entry.requestContext || [],
              ...entry.config,
            }),
          },
        },
        response: {
          status: 200,
          statusText: "OK",
          content: {
            mimeType: "application/json",
            text: JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: entry.responseParts || [{ text: "response" }],
                  },
                },
              ],
            }),
          },
        },
      })),
    },
  } as unknown as Har;
}

describe("collateContexts", () => {
  it("should collate turns with same config and prefix", () => {
    const har = createMockHar([
      {
        startedDateTime: "2024-01-01T10:00:00.000Z",
        requestContext: [{ role: "user", parts: [{ text: "Hello" }] }],
        config: { generationConfig: { temperature: 0.5 } },
      },
      {
        startedDateTime: "2024-01-01T10:01:00.000Z",
        requestContext: [
          { role: "user", parts: [{ text: "Hello" }] },
          { role: "model", parts: [{ text: "response" }] },
          { role: "user", parts: [{ text: "World" }] },
        ],
        config: { generationConfig: { temperature: 0.5 } },
      },
    ]);

    const reports = collateContexts(har);
    deepStrictEqual(reports.length, 1);
    deepStrictEqual(reports[0].turnCount, 2);
  });

  it("should NOT collate turns with different config even if prefix matches", () => {
    const har = createMockHar([
      {
        startedDateTime: "2024-01-01T10:00:00.000Z",
        requestContext: [{ role: "user", parts: [{ text: "Hello" }] }],
        config: { generationConfig: { temperature: 0.5 } },
      },
      {
        startedDateTime: "2024-01-01T10:01:00.000Z",
        requestContext: [
          { role: "user", parts: [{ text: "Hello" }] },
          { role: "model", parts: [{ text: "response" }] },
          { role: "user", parts: [{ text: "World" }] },
        ],
        config: { generationConfig: { temperature: 0.9 } }, // Different config
      },
    ]);

    const reports = collateContexts(har);
    // Should be 2 separate chains because the second one cannot be a child of the first due to config mismatch
    deepStrictEqual(reports.length, 2);
    deepStrictEqual(reports[0].turnCount, 1);
    deepStrictEqual(reports[1].turnCount, 1);
  });
});
