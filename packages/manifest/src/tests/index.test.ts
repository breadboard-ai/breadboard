/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { randomUUID } from "crypto";
import fs from "fs";
import * as assert from "node:assert";
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
let mockedResponses: Map<string, any>;
before(() => {
  validate = ajv.compile(schema);
});

before(() => {
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

test("Schema is valid.", async () => {
  assert.ok(validate);
});

// Declare the constants with types

const dereferencedBoard = (): DereferencedBoard => ({ edges: [], nodes: [] });
const dereferencedManifest = (): DereferencedManifest => ({
  title: "Dereferenced Manifest",
  boards: [],
  manifests: [],
});
const localBoardReference = (): ReferencedBoard => ({
  title: "Local Board Reference",
  url: generateLocalFilePath(),
});
const remoteBoardReference = (): ReferencedBoard => ({
  title: "Remote Board Reference",
  url: generateGistURL(),
});
const localManifestReference = (): ReferencedManifest => ({
  title: "Local Manifest Reference",
  url: generateLocalFilePath(),
});
const remoteManifestReference = (): ReferencedManifest => ({
  title: "Remote Manifest Reference",
  url: generateGistURL(),
});
const fixtures = (): BreadboardManifest[] => [
  { title: "Manifest with an empty boards array", boards: [] },
  { title: "Manifest with an empty manifests array", manifests: [] },
  {
    title: "Manifest with empty boards and manifests arrays",
    boards: [],
    manifests: [
      {
        title: "Gist Manifest",
        url: generateGistURL(),
      },
    ],
  },
  {
    title: "Manifest with boards",
    boards: [
      {
        title: "My First Board",
        url: generateGistURL(),
      },
      {
        title: "My Second Board",
        url: generateLocalFilePath("board.bgl.json"),
      },
    ],
  },
  {
    title: "Manifest with manifests",
    manifests: [
      {
        title: "Gist Manifest",
        url: generateGistURL("manifest.bbm.json"),
      },
    ],
  },
  {
    title: "Manifest with boards and manifests",
    boards: [
      {
        title: "My First Board",
        url: generateGistURL(),
      },
      {
        title: "My Second Board",
        url: generateLocalFilePath("manifest.bbm.json"),
      },
    ],
    manifests: [
      {
        title: "Gist Manifest",
        url: generateGistURL(),
      },
    ],
  },
  {
    title: "Nested manifest",
    manifests: [
      {
        title: "Gist Manifest",
        url: generateGistURL(),
      },
      {
        title: "Nested Nested Manifest",
        boards: [
          {
            title: "My First Board",
            url: generateGistURL(),
          },
        ],
        manifests: [
          {
            title: "Nested Nested Nested Manifest",
            boards: [
              {
                title: "My First Board",
                url: generateGistURL(),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Manifest with a single dereferenced board",
    boards: [dereferencedBoard()],
  },
  {
    title: "Manifest with a single local board reference",
    boards: [localBoardReference()],
  },
  {
    title: "Manifest with a single remote board reference",
    boards: [remoteBoardReference()],
  },
  {
    title: "Manifest with dereferenced, local, and remote boards",
    boards: [
      dereferencedBoard(),
      localBoardReference(),
      remoteBoardReference(),
    ],
  },
  {
    title: "Manifest with a single dereferenced manifest",
    manifests: [dereferencedManifest()],
  },
  {
    title: "Manifest with a single local manifest reference",
    manifests: [localManifestReference()],
  },
  {
    title: "Manifest with a single remote manifest reference",
    manifests: [remoteManifestReference()],
  },
  {
    title: "Manifest with dereferenced, local, and remote manifests",
    manifests: [
      dereferencedManifest(),
      localManifestReference(),
      remoteManifestReference(),
    ],
  },
];

const nestedManifest = (): BreadboardManifest => ({
  manifests: [
    {
      manifests: [
        dereferencedManifest(),
        localManifestReference(),
        remoteManifestReference(),
      ],
    },
    { manifests: fixtures() },
    {
      boards: [
        localBoardReference(),
        remoteBoardReference(),
        dereferencedBoard(),
      ],
    },
  ],
  boards: [localBoardReference(), remoteBoardReference(), dereferencedBoard()],
});

const testManifestValidation = (
  manifest: BreadboardManifest,
  index: number
) => {
  test(
    [`Manifest ${index + 1}/${fixtures().length}`, manifest.title]
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

for (const [index, manifest] of fixtures().entries()) {
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

  type TestDefinition = {
    name: string;
    reference: Resource;
    expected: DereferencedBoard | DereferencedManifest;
  };

  const dereferenceTests: TestDefinition[] = [
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
        url: path.resolve("non-board.json"),
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

function generateGistURL(extension: string = "file.json"): string {
  return `https://gist.githubusercontent.com/user/${randomUUID()}/raw/${randomUUID()}.${extension}`;
}

function mockManifestFetches(fixture: BreadboardManifest) {
  for (const board of fixture.boards || []) {
    if (!isResourceReference(board)) {
      addResponseToMocked(board, {
        edges: [],
        nodes: [],
      });
    }
  }
  for (const manifest of fixture.manifests || []) {
    if (isResourceReference(manifest)) {
      addResponseToMocked(manifest, {
        title: "Dereferenced Manifest",
        boards: [],
        manifests: [],
      });
    }
    mockManifestFetches(manifest);
  }
}

function getMockedResponse(path: string, fn: (x: any) => any) {
  const fullyDecodedPath = fullyDecodeURI(path);
  if (mockedResponses.has(fullyDecodedPath)) {
    path = fullyDecodedPath;
  }
  if (mockedResponses.has(path)) {
    const responseData = mockedResponses.get(path);
    return fn(responseData);
  } else {
    throw new Error(`No mocked response for: ${path}`);
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
    if (mockedResponses.has(decodedUrl)) {
      throw new Error(`Mocked response already exists for ${decodedUrl}`);
    }
    mockedResponses.set(decodedUrl, expected);
  }
}

after(() => mock.reset());
function generateLocalFilePath(extension: string = "file.json"): string {
  return encodeURI(path.resolve(`${randomUUID()}.${extension}`));
}
