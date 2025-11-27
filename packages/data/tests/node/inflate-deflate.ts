import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { DataPartTransformer, DataStore } from "@breadboard-ai/types";
import { LLMContent } from "@breadboard-ai/types";
import { transformContents } from "../../src/inflate-deflate.js";
import { isStoredData } from "../../src/common.js";

function makeStoredData(handle: string) {
  return { storedData: { handle } };
}

describe("inflate-deflate", () => {
  const mockBlob = (data: string, type = "text/plain") =>
    new Blob([atob(data)], { type });

  const fakeStoreMethod = (blob: unknown) => {
    stored.push(blob);
    return {
      storedData: {
        handle: `stored-${stored.length}`,
      },
    };
  };

  const mockTransformer = {
    persistPart: fakeStoreMethod,
    toFileData: () => undefined,
  } as unknown as DataPartTransformer;

  const mockStore = {
    retrieveAsBlob: async () => {
      return mockBlob(btoa("hello world"), "text/plain");
    },
    store: fakeStoreMethod,
    transformer: () => mockTransformer,
  } as unknown as DataStore;

  let stored: unknown[] = [];

  beforeEach(() => {
    stored = [];
    mock.method(mockTransformer, "persistPart", async (blob: Blob) => {
      const handle = `mock-handle-${stored.length}`;
      stored.push({ blob, handle });
      return makeStoredData(handle);
    });
  });

  describe("transformContents", () => {
    it("calls transformDataParts and returns transformed content if ok", async () => {
      mock.method(mockTransformer, "toFileData", () => {
        return {
          storedData: {
            handle: "test-1",
          },
        };
      });
      const input: LLMContent[] = [
        { parts: [{ inlineData: { data: "abc", mimeType: "text/plain" } }] },
      ];
      const result = (await transformContents(
        mockStore,
        input,
        "persistent-temporary",
        new URL("http://test.com")
      )) as LLMContent[];
      assert(isStoredData(result[0].parts[0]));
    });
  });
});
