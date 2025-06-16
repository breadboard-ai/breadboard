import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert";
import {
  DataPartTransformer,
  DataStore,
  deflateData,
  inflateData,
  isStoredData,
  transformContents,
} from "../../../src/index.js";
import {
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";

function makeStoredData(handle: string) {
  return { storedData: { handle } };
}

describe("inflate-deflate", () => {
  const mockBlob = (data: string, type = "text/plain") =>
    new Blob([atob(data)], { type });

  const fakeStoreMethod = (blob: any) => {
    stored.push(blob);
    return {
      storedData: {
        handle: `stored-${stored.length}`,
      },
    };
  };

  let mockTransformer = {
    persistPart: fakeStoreMethod,
    toFileData: () => undefined,
  } as unknown as DataPartTransformer;

  let mockStore = {
    retrieveAsBlob: async (value: any) => {
      // Simulate retrieving a blob from storedData
      if (value.storedData?.handle === "test-handle") {
        return mockBlob(btoa("hello world"), "text/plain");
      }
      throw new Error("Unknown handle");
    },
    store: fakeStoreMethod,
    transformer: () => mockTransformer,
  } as unknown as DataStore;

  let stored: any[] = [];

  beforeEach(() => {
    stored = [];
    mock.method(mockTransformer, "persistPart", async (blob: Blob) => {
      const handle = `mock-handle-${stored.length}`;
      stored.push({ blob, handle });
      return makeStoredData(handle);
    });
  });

  describe("inflateData", () => {
    it("returns primitives as is", async (t) => {
      assert.equal(await inflateData(mockStore, 42), 42);
      assert.equal(await inflateData(mockStore, "foo"), "foo");
      assert.equal(await inflateData(mockStore, null), null);
    });

    it("processes arrays recursively", async () => {
      const arr = [1, { storedData: { handle: "test-handle" } }, 3];
      const result = await inflateData(mockStore, arr);
      assert(Array.isArray(result));
      assert.strictEqual((result as any[])[0], 1);
      assert.deepStrictEqual((result as any[])[2], 3);
      assert((result as any[])[1].inlineData);
    });

    it("processes objects recursively", async () => {
      const obj = {
        a: 1,
        b: { storedData: { handle: "test-handle" } },
        c: "foo",
      };
      const result = await inflateData(mockStore, obj);
      assert.strictEqual((result as any).a, 1);
      assert.strictEqual((result as any).c, "foo");
      assert((result as any).b.inlineData);
      assert.strictEqual((result as any).b.inlineData.mimeType, "text/plain");
    });

    it("inflates storedData to inlineData", async () => {
      const obj = {
        storedData: { handle: "test-handle" },
      };
      const result = await inflateData(mockStore, obj);
      assert((result as any).inlineData);
      assert.strictEqual((result as any).inlineData.mimeType, "text/plain");
      assert.strictEqual(typeof (result as any).inlineData.data, "string");
    });

    it("with inflateToFileData and transformer", async () => {
      const mockTransformer = {
        persistPart: () => undefined,
        toFileData: () => undefined,
      } as unknown as DataPartTransformer;
      mock.method(mockTransformer, "toFileData", () => {
        return [
          { parts: [{ fileData: { data: "abc", mimeType: "foo/bar" } }] },
        ];
      });
      const obj = { fileData: { data: "abc", mimeType: "foo/bar" } };
      const result = await inflateData(
        mockStore,
        obj,
        new URL("http://x"),
        true
      );
      assert((result as any).fileData);
      assert.strictEqual((result as any).fileData.data, "abc");
      assert.strictEqual((result as any).fileData.mimeType, "foo/bar");
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
      mock.method(
        mockTransformer,
        "persistPart",
        (
          url: URL,
          part: InlineDataCapabilityPart | StoredDataCapabilityPart
        ) => {
          return {
            storedData: {
              handle: "test-1",
            },
          };
        }
      );
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
