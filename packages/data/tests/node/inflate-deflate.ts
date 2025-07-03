import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import { DataPartTransformer, DataStore } from "@breadboard-ai/types";
import { InlineDataCapabilityPart, LLMContent } from "@breadboard-ai/types";
import {
  deflateData,
  inflateData,
  transformContents,
} from "../../src/inflate-deflate.js";
import { isStoredData } from "@breadboard-ai/utils";

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

  describe("inflateData", () => {
    it("returns primitives as is", async () => {
      assert.equal(await inflateData(mockStore, 42), 42);
      assert.equal(await inflateData(mockStore, "foo"), "foo");
      assert.equal(await inflateData(mockStore, null), null);
    });

    it("processes objects recursively", async () => {
      const obj = {
        a: 1,
        b: { storedData: { handle: "test-handle" } },
        c: "foo",
      };
      const result = await inflateData(mockStore, obj);
      assert.deepEqual(
        {
          a: 1,
          b: {
            inlineData: { data: "aGVsbG8gd29ybGQ", mimeType: "text/plain" },
          },
          c: "foo",
        },
        result
      );
    });

    it("inflates storedData to inlineData", async () => {
      const obj = {
        storedData: { handle: "test-handle" },
      };
      const result = (await inflateData(
        mockStore,
        obj
      )) as InlineDataCapabilityPart;
      assert(result.inlineData);
      assert.strictEqual(result.inlineData.mimeType, "text/plain");
      assert.strictEqual(typeof result.inlineData.data, "string");
    });
  });

  describe("deflateData", () => {
    function makeInlineData(data: string, mimeType = "text/plain") {
      return { inlineData: { data, mimeType } };
    }

    it("should leave primitives unchanged", async () => {
      assert.equal(await deflateData(mockStore, 42), 42);
      assert.equal(await deflateData(mockStore, "hello"), "hello");
      assert.equal(await deflateData(mockStore, null), null);
      assert.equal(await deflateData(mockStore, undefined), undefined);
    });

    it("should convert InlineDataCapabilityPart to StoredDataCapabilityPart", async () => {
      const data = makeInlineData(
        Buffer.from("hello").toString("base64"),
        "text/plain"
      );
      const result = await deflateData(mockStore, data);
      assert(isStoredData(result));
      assert.equal(stored.length, 1);
    });

    it("should leave StoredDataCapabilityPart unchanged except for deleting .data", async () => {
      const data = { storedData: { handle: "abc" }, data: "should be deleted" };
      const result = await deflateData(mockStore, data);
      assert(isStoredData(result));
      assert.equal(result.storedData.handle, "abc");
      assert(!("data" in result), ".data should be deleted");
    });

    it("should recursively deflate InlineDataCapabilityPart", async () => {
      const arr = [
        makeInlineData(Buffer.from("foo").toString("base64")),
        {
          someProp: makeInlineData(Buffer.from("b").toString("base64")),
        },
      ];
      const result = await deflateData(mockStore, arr);
      assert(Array.isArray(result));
      assert(isStoredData(result[0]));
      assert(isStoredData(result[1].someProp));
      assert.equal(stored.length, 2);
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
