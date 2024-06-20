/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import * as assert from "node:assert";
import test, { after, before, describe, mock } from "node:test";
import path from "path";
import { inspect } from "util";
import {
  BreadboardManifest,
  DereferencedBoard,
  DereferencedManifest,
} from "..";
import {
  dereference,
  dereferenceBoard,
  dereferenceManifest,
  dereferenceManifestContents,
  fullyDecodeURI,
  isEncoded,
} from "../dereference";
import { isBglLike, isDereferencedBoard } from "../types/guards/board-resource";
import { isDereferencedManifest } from "../types/guards/manifest-resource";
import {
  isLocalResource,
  isLocalUri,
  isRemoteResource,
  isRemoteUri,
  isResourceReference,
} from "../types/guards/resource-reference";
import { Resource } from "../types/resource";
import {
  dereferencedBoard,
  dereferencedManifest,
  localBoardReference,
  localManifestReference,
  manifestArray,
  nestedManifest,
  remoteBoardReference,
  remoteManifestReference,
} from "./data.test";
import {
  getMockedAsyncReadFileResponse,
  getMockedFetchResponse,
  getReadFileSyncResponse,
} from "./helpers.test";

const schema = await import("../../bbm.schema.json" as any).then(
  (module) => module.default
);

const ajv = new Ajv({
  validateSchema: true,
  validateFormats: true,
  strictTypes: true,
  strict: true,
  verbose: true,
  allErrors: true,
});
addFormats(ajv);

function addResponseToMocked(reference: Resource, expected: any) {
  if ("url" in reference) {
    const decodedUrl = fullyDecodeURI(reference.url!);
    if (mockedResponses.has(decodedUrl)) {
      throw new Error(`Mocked response already exists for ${decodedUrl}`);
    }
    mockedResponses.set(decodedUrl, expected);
  }
}

function getMockedResponse(path: string, fn: (x: any) => any) {
  const fullyDecodedPath = fullyDecodeURI(path);
  const responseData = mockedResponses.get(fullyDecodedPath || path);
  if (responseData) {
    return fn(responseData);
  } else {
    throw new Error(`No mocked response for: ${path}`);
  }
}

function mockManifestFetches(fixture: BreadboardManifest) {
  for (const board of fixture.boards || []) {
    if (isResourceReference(board)) {
      addResponseToMocked(board, { edges: [], nodes: [] });
    }
  }
  for (const manifest of fixture.manifests || []) {
    if (isResourceReference(manifest)) {
      addResponseToMocked(manifest, { boards: [], manifests: [] });
    }
    mockManifestFetches(manifest);
  }
}

let validate: ValidateFunction;
let mockedResponses: Map<string, any>;

before(() => {
  validate = ajv.compile(schema);
  mockedResponses = new Map();

  mock.method(fs, "readFileSync", (path: string) =>
    getMockedResponse(path, getReadFileSyncResponse)
  );
  mock.method(fs.promises, "readFile", (path: string) =>
    getMockedResponse(path, getMockedAsyncReadFileResponse)
  );
  mock.method(global, "fetch", (path: string) =>
    getMockedResponse(path, getMockedFetchResponse)
  );
});

// Validation Tests
describe("Validation Tests", () => {
  test("Schema is valid.", async () => {
    assert.ok(validate);
  });

  manifestArray().forEach((manifest, index) => {
    test(`Manifest ${index + 1}/${manifestArray().length}: ${manifest.title || ""}`, async () => {
      const valid = validate(manifest);
      const errors = validate.errors;
      if (errors) {
        throw new Error(inspect(errors, { depth: null, colors: true }));
      }
      assert.ok(!errors);
      assert.ok(valid);
    });
  });
});

// BreadboardManifest Tests
describe("BreadboardManifest", () => {
  type TestCase<T> = [T, boolean];

  const testCases: {
    name: string;
    method: (input: any) => boolean;
    cases: TestCase<any>[];
  }[] = [
    {
      name: "isBglLike",
      method: isBglLike,
      cases: [
        [dereferencedBoard(), true],
        [dereferencedManifest(), false],
      ],
    },
    {
      name: "isDereferencedManifest",
      method: isDereferencedManifest,
      cases: [
        [{ boards: [] }, true],
        [{ manifests: [] }, true],
        [dereferencedBoard(), false],
      ],
    },
    {
      name: "isRemoteUri",
      method: isRemoteUri,
      cases: [
        ["https://example.com", true],
        ["./path/to/file", false],
      ],
    },
    {
      name: "isLocalUri",
      method: isLocalUri,
      cases: [
        ["./path/to/file", true],
        ["https://example.com", false],
      ],
    },
    {
      name: "isResourceReference",
      method: isResourceReference,
      cases: [
        [localManifestReference(), true],
        [remoteManifestReference(), true],
        [localBoardReference(), true],
        [remoteBoardReference(), true],
        [dereferencedManifest(), false],
        [dereferencedBoard(), false],
      ],
    },
    {
      name: "isRemoteResource",
      method: isRemoteResource,
      cases: [
        [localManifestReference(), false],
        [remoteManifestReference(), true],
        [localBoardReference(), false],
        [remoteBoardReference(), true],
        [dereferencedManifest(), false],
        [dereferencedBoard(), false],
      ],
    },
    {
      name: "isLocalResource",
      method: isLocalResource,
      cases: [
        [localManifestReference(), true],
        [remoteManifestReference(), false],
        [dereferencedManifest(), false],
        [dereferencedBoard(), false],
      ],
    },
    {
      name: "isDereferencedBoard",
      method: isDereferencedBoard,
      cases: [
        [dereferencedBoard(), true],
        [dereferencedManifest(), false],
      ],
    },
  ];

  testCases.forEach(({ name, method, cases }) => {
    describe(name, () => {
      cases.forEach(([input, expected]) => {
        test(`${name}(${JSON.stringify(input)}) should return ${expected}`, () => {
          assert.strictEqual(method(input), expected);
        });
      });
    });
  });

  const dereferenceTests: {
    name: string;
    reference: Resource;
    expected: DereferencedBoard | DereferencedManifest;
  }[] = [
    {
      name: "remote manifest",
      reference: remoteManifestReference(),
      expected: dereferencedManifest(),
    },
    {
      name: "local manifest",
      reference: localManifestReference(),
      expected: dereferencedManifest(),
    },
    {
      name: "dereferenced manifest",
      reference: dereferencedManifest(),
      expected: dereferencedManifest(),
    },
    {
      name: "remote board",
      reference: remoteBoardReference(),
      expected: dereferencedBoard(),
    },
    {
      name: "local board",
      reference: localBoardReference(),
      expected: dereferencedBoard(),
    },
    {
      name: "dereferenced board",
      reference: dereferencedBoard(),
      expected: dereferencedBoard(),
    },
  ];

  describe("dereference", () => {
    dereferenceTests.forEach(({ name, reference, expected }) => {
      test(`${name} reference should be dereferenced correctly`, async () => {
        addResponseToMocked(reference, expected);
        const dereferenced = await dereference(reference);
        assert.ok(dereferenced);
        assert.deepEqual(dereferenced, expected);
      });
    });

    test("should throw if dereferencing returns something other than a board or manifest", async () => {
      const nonBoardReference = { url: path.resolve("non-board.json") };
      const nonBoardData = { blah: "blah" };
      addResponseToMocked(nonBoardReference, nonBoardData);

      await assert.rejects(dereference(nonBoardReference), (e) => {
        assert.ok(e instanceof Error);
        return true;
      });
    });
  });

  describe("dereferenceBoard", () => {
    test("should return a DereferencedBoard object", async () => {
      const expected = dereferencedBoard();
      const reference = remoteBoardReference();
      addResponseToMocked(reference, expected);
      const dereferenced = await dereferenceBoard(reference);
      assert.ok(isDereferencedBoard(dereferenced));
      assert.deepEqual(dereferenced, expected);
    });

    test("should throw if dereferencing returns something other than a board", async () => {
      const reference = remoteBoardReference();
      const expected = dereferencedManifest();
      addResponseToMocked(reference, expected);
      await assert.rejects(dereferenceBoard(reference));
    });
  });

  describe("dereferenceManifest", () => {
    test("should return a DereferencedManifest object", async () => {
      const expected = dereferencedManifest();
      const reference = remoteManifestReference();
      addResponseToMocked(reference, expected);
      const dereferenced = await dereferenceManifest(reference);
      assert.ok(isDereferencedManifest(dereferenced));
      assert.deepEqual(dereferenced, expected);
    });

    test("should throw if dereferencing returns something other than a manifest", async () => {
      const reference = remoteManifestReference();
      const expected = dereferencedBoard();
      addResponseToMocked(reference, expected);
      await assert.rejects(dereferenceManifest(reference));
    });
  });

  describe("dereferenceManifestContents", () => {
    test("should dereference all boards and manifests contained in a manifest", async () => {
      const fixture = nestedManifest();
      mockManifestFetches(fixture);
      const dereferenced = await dereferenceManifestContents(fixture);
      assert.ok(dereferenced);
    });
  });
});

// Utility Function Tests
describe("Utility Functions", () => {
  describe("isEncoded", () => {
    test("should return true if the URI is encoded", () => {
      assert.ok(isEncoded(encodeURI("./path with spaces/file.json")));
    });
    test("should return false if the URI is not encoded", () => {
      assert.ok(!isEncoded("./path with spaces/file.json"));
    });
    test("should handle nullish values", () => {
      assert.ok(!isEncoded(null as any));
      assert.ok(!isEncoded(undefined as any));
    });
  });

  test("test mock fetch", async () => {
    mock.method(global, "fetch", () => ({
      json: () => ({ key: "value" }),
      status: 200,
    }));
    const response = await fetch("foo");
    assert.strictEqual(response.status, 200);

    const responseJson = await response.json();
    assert.strictEqual(responseJson.key, "value");
  });
});

after(() => mock.reset());
