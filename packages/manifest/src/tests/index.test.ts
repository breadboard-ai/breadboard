/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import * as assert from "node:assert";
import { AssertionError } from "node:assert";
import test, { after, before, describe, mock } from "node:test";
import path from "path";
import { inspect } from "util";
import { BreadboardManifest } from "..";
import schema from "../../bbm.schema.json" with { type: "json" };
import {
  dereference,
  dereferenceBoard,
  dereferenceManifest,
  dereferenceManifestContents,
  fullyDecodeURI,
} from "../dereference";
import { DereferencedBoard, ReferencedBoard } from "../types/boards";
import { isBglLike, isDereferencedBoard } from "../types/guards/board-resource";
import { isDereferencedManifest } from "../types/guards/manifest-resource";
import {
  isLocalResource,
  isLocalUri,
  isRemoteResource,
  isRemoteUri,
  isResourceReference,
} from "../types/guards/resource-reference";
import { DereferencedManifest, ReferencedManifest } from "../types/manifest";
import { Resource } from "../types/resource";

const ajv = new Ajv({
  // keywords: definitions({
  //   // defaultMeta: "draft-07",
  // }),
  validateSchema: true,
  validateFormats: true,
  strictTypes: true,
  strict: true,
  formats: {
    // "uri-reference": require("ajv-formats/dist/formats").fullFormats["uri-reference"],
  },
  verbose: true,
  allErrors: true,
});
addFormats(ajv);

let validate: ValidateFunction;

before(() => {
  validate = ajv.compile(schema);
});

before(() => {
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

test("Schema is valid.", async () => {
  assert.ok(validate);
});

async function assertThrowsAsynchronously(
  test: { (): Promise<any> },
  error: Error
) {
  try {
    await test();
  } catch (e) {
    // if (!error || e instanceof Error) return "everything is fine";
    throw new AssertionError({
      message: "Unexpected error",
      actual: e,
      expected: error,
    });
  }
  // throw new AssertionError({
  //   message: "Missing rejection" + (error ? " with " + error.name : ""),
  // });
}

// Declare the constants with types
const dereferencedBoard: DereferencedBoard = { edges: [], nodes: [] };
const dereferencedManifest: DereferencedManifest = {
  title: "Dereferenced Manifest",
  boards: [],
  manifests: [],
};
const localBoardReference: ReferencedBoard = {
  title: "Local Board Reference",
  url: encodeURI(path.resolve(import.meta.dirname, "board.bgl.json")),
};
const remoteBoardReference: ReferencedBoard = {
  title: "Remote Board Reference",
  url: "https://example.com/board.bgl.json",
};
const localManifestReference: ReferencedManifest = {
  title: "Local Manifest Reference",
  url: encodeURI(path.resolve(import.meta.dirname, "manifest.bbm.json")),
};
const remoteManifestReference: ReferencedManifest = {
  title: "Remote Manifest Reference",
  url: "https://example.com/manifest.bbm.json",
};

const fixtures: BreadboardManifest[] = [
  { title: "Manifest with an empty boards array", boards: [] },
  { title: "Manifest with an empty manifests array", manifests: [] },
  {
    title: "Manifest with empty boards and manifests arrays",
    boards: [],
    manifests: [
      {
        title: "Gist Manifest",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
  {
    title: "Manifest with boards",
    boards: [
      {
        title: "My First Board",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
      },
      { title: "My Second Board", url: "./boards/board.bgl.json" },
    ],
  },
  {
    title: "Manifest with manifests",
    manifests: [
      {
        title: "Gist Manifest",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
  {
    title: "Manifest with boards and manifests",
    boards: [
      {
        title: "My First Board",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
      },
      { title: "My Second Board", url: "./boards/board.bgl.json" },
    ],
    manifests: [
      {
        title: "Gist Manifest",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
    ],
  },
  {
    title: "Nested manifest",
    manifests: [
      {
        title: "Gist Manifest",
        url: "https://gist.githubusercontent.com/user/SOME_ID/raw/manifest.bbm.json",
      },
      {
        title: "Nested Nested Manifest",
        boards: [
          {
            title: "My First Board",
            url: "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
          },
        ],
        manifests: [
          {
            title: "Nested Nested Nested Manifest",
            boards: [
              {
                title: "My First Board",
                url: "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Manifest with a single dereferenced board",
    boards: [dereferencedBoard],
  },
  {
    title: "Manifest with a single local board reference",
    boards: [localBoardReference],
  },
  {
    title: "Manifest with a single remote board reference",
    boards: [remoteBoardReference],
  },
  {
    title: "Manifest with dereferenced, local, and remote boards",
    boards: [dereferencedBoard, localBoardReference, remoteBoardReference],
  },
  {
    title: "Manifest with a single dereferenced manifest",
    manifests: [dereferencedManifest],
  },
  {
    title: "Manifest with a single local manifest reference",
    manifests: [localManifestReference],
  },
  {
    title: "Manifest with a single remote manifest reference",
    manifests: [remoteManifestReference],
  },
  {
    title: "Manifest with dereferenced, local, and remote manifests",
    manifests: [
      dereferencedManifest,
      localManifestReference,
      remoteManifestReference,
    ],
  },
];

const nestedManifest: BreadboardManifest = {
  manifests: fixtures,
  boards: [localBoardReference, remoteBoardReference, dereferencedBoard],
};

const testManifestValidation = (
  manifest: BreadboardManifest,
  index: number
) => {
  test(
    [`Manifest ${index + 1}/${fixtures.length}`, manifest.title]
      .filter(Boolean)
      .join(": "),
    async (t) => {
      const valid = validate(manifest);
      const errors = validate.errors;
      if (errors) {
        throw new Error(inspect(errors, { depth: null, colors: true }));
      }
      assert.ok(!errors);
      assert.ok(valid);
    }
  );
};

for (const [index, manifest] of fixtures.entries()) {
  testManifestValidation(manifest, index);
}

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
        [dereferencedBoard, true],
        [dereferencedManifest, false],
      ],
    },
    {
      name: "isDereferencedManifest",
      method: isDereferencedManifest,
      cases: [
        [{ boards: [] }, true],
        [{ manifests: [] }, true],
        [dereferencedBoard, false],
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
        [localManifestReference, true],
        [remoteManifestReference, true],
        [localBoardReference, true],
        [remoteBoardReference, true],
        [dereferencedManifest, false],
        [dereferencedBoard, false],
      ],
    },
    {
      name: "isRemoteResource",
      method: isRemoteResource,
      cases: [
        [localManifestReference, false],
        [remoteManifestReference, true],
        [localBoardReference, false],
        [remoteBoardReference, true],
        [dereferencedManifest, false],
        [dereferencedBoard, false],
      ],
    },
    {
      name: "isLocalResource",
      method: isLocalResource,
      cases: [
        [localManifestReference, true],
        [remoteManifestReference, false],
        [dereferencedManifest, false],
        [dereferencedBoard, false],
      ],
    },
    {
      name: "isDereferencedBoard",
      method: isDereferencedBoard,
      cases: [
        [dereferencedBoard, true],
        [dereferencedManifest, false],
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

  type TestDefinition = {
    name: string;
    reference: Resource;
    expected: DereferencedBoard | DereferencedManifest;
  };

  const dereferenceTests: TestDefinition[] = [
    {
      name: "remote manifest",
      reference: remoteManifestReference,
      expected: dereferencedManifest,
    },
    {
      name: "local manifest",
      reference: localManifestReference,
      expected: dereferencedManifest,
    },
    {
      name: "dereferenced manifest",
      reference: dereferencedManifest,
      expected: dereferencedManifest,
    },
    {
      name: "remote board",
      reference: remoteBoardReference,
      expected: dereferencedBoard,
    },
    {
      name: "local board",
      reference: localBoardReference,
      expected: dereferencedBoard,
    },
    {
      name: "dereferenced board",
      reference: dereferencedBoard,
      expected: dereferencedBoard,
    },
  ];

  describe("dereference", () => {
    dereferenceTests.forEach(
      ({ name, reference, expected }: TestDefinition) => {
        test(`${name} reference should be dereferenced correctly`, async () => {
          addResponseToMocked(reference, expected);
          const dereferenced = await dereference(reference);
          assert.ok(dereferenced);
          assert.deepEqual(dereferenced, expected);
        });
      }
    );

    test("should throw if dereferencing returns something other than a board or manifest", async () => {
      const nonBoardReference = {
        url: path.resolve(import.meta.dirname, "non-board.json"),
      };
      const nonBoardData = {
        blah: "blah",
      };
      addResponseToMocked(nonBoardReference, nonBoardData);

      try {
        const result = await dereference(nonBoardReference);
        assert.fail("Expected an error to be thrown.");
      } catch (e) {
        assert.ok(e instanceof Error);
      }
    });
  });

  describe("dereferenceBoard", () => {
    test("should return a DereferencedBoard object", async () => {
      mockFetchResponse(dereferencedBoard);
      const dereferenced = await dereferenceBoard(remoteBoardReference);
      assert.ok(isDereferencedBoard(dereferenced));
      assert.deepEqual(dereferenced, dereferencedBoard);
    });

    test("should throw if dereferencing returns something other than a board", async () => {
      mockFetchResponse(dereferencedManifest);
      await assert.rejects(dereferenceBoard(remoteBoardReference));
    });
  });

  describe("dereferenceManifest", () => {
    test("should return a DereferencedManifest object", async () => {
      mockFetchResponse(dereferencedManifest);
      const dereferenced = await dereferenceManifest(remoteManifestReference);
      assert.ok(isDereferencedManifest(dereferenced));
      assert.deepEqual(dereferenced, dereferencedManifest);
    });

    test("should throw if dereferencing returns something other than a manifest", async () => {
      mockFetchResponse(dereferencedBoard);
      await assert.rejects(dereferenceManifest(remoteManifestReference));
    });
  });

  describe("dereferenceManifestContents", () => {
    test("should dereference all boards and manifests contained in a manifest", async () => {
      const fixture = nestedManifest;
      mockManifestFetches(fixture);

      const dereferenced = await dereferenceManifestContents(fixture);
      assert.ok(dereferenced);
    });
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

function mockManifestFetches(fixture: BreadboardManifest) {
  fixture.manifests?.forEach((manifest) => {
    if (!isResourceReference(manifest)) {
      addResponseToMocked(manifest, {
        title: "Dereferenced Manifest",
        boards: [],
        manifests: [],
      });
    }
    manifest.manifests?.forEach((nestedManifest) => {
      mockManifestFetches(nestedManifest);
    });
  });
  fixture.boards?.forEach((board) => {
    if (!isResourceReference(board)) {
      addResponseToMocked(board, {
        edges: [],
        nodes: [],
      });
    }
  });
}

function writeManifestsToFile() {
  fs.writeFileSync(
    "manifests.json",
    JSON.stringify(
      { $schema: "./bbm.schema.json", manifests: fixtures },
      null,
      "\t"
    )
  );
}

const mockedResponses: Map<string, any> = new Map();

function getMockedResponse(path: string, fn: (x: any) => any) {
  const fullyDecodedPath = fullyDecodeURI(path);
  if (mockedResponses.has(fullyDecodedPath)) {
    path = fullyDecodedPath;
  }
  if (mockedResponses.has(path)) {
    const responseData = mockedResponses.get(path);
    return fn(responseData);
  } else {
    throw new Error("File not found.");
  }
}

function getMockedFetchResponse(mockedResponse: any) {
  return {
    then: (cb: any) => cb({ json: () => Promise.resolve(mockedResponse) }),
    status: 200,
  };
}

function getMockedAsyncReadFileResponse(mockedResponse: any): {
  then: (cb: any) => any;
} {
  return { then: (cb: any) => cb(JSON.stringify(mockedResponse)) };
}

function getReadFileSyncResponse(mockedResponse: any): string {
  return JSON.stringify(mockedResponse);
}

function addResponseToMocked(reference: Resource, expected: any) {
  if ("url" in reference) {
    // mockedResponses[reference.url!] = expected;
    const decodedUrl = fullyDecodeURI(reference.url!);
    mockedResponses.set(decodedUrl, expected);
  }
}

function mockFetchResponse(obj: any) {
  mock.method(global, "fetch", () => ({
    then: () => obj,
    status: 200,
  }));
}
describe("test assert.throws", () => {
  function shouldThrow(throwError: boolean) {
    if (throwError) throw new Error("Exception Thrown");
  }

  assert.throws(() => {
    shouldThrow(true);
  }, Error);
});

after(() => mock.reset());
