/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import * as assert from "node:assert";
import test, { describe, mock } from "node:test";
import path from "path";
import { BreadboardManifest } from "..";
import schema from "../../bbm.schema.json" with { type: "json" };
import { dereference } from "../functions/dereference";
import { dereferenceBoard } from "../functions/dereference-board";
import { dereferenceManifest } from "../functions/dereference-manifest";
import { isBglLike } from "../functions/is-bgl-like";
import { isDereferencedBoard } from "../functions/is-dereferenced-board";
import { isDereferencedManifest } from "../functions/is-dereferenced-manifest";
import { isLocalResource } from "../functions/is-local-resource";
import { isLocalUri } from "../functions/is-local-uri";
import { isRemoteResource } from "../functions/is-remote-resource";
import { isRemoteUri } from "../functions/is-remote-uri";
import { isResourceReference } from "../functions/is-resource-reference";
import { DereferencedBoard, ReferencedBoard } from "../types/boards";
import { DereferencedManifest, ReferencedManifest } from "../types/manifest";
import { Resource, ResourceReference } from "../types/resource";

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

test.before(() => {
  validate = ajv.compile(schema);
});

test("Schema is valid.", async () => {
  assert.ok(validate);
});

// Declare the constants with types
const dereferencedBoard: DereferencedBoard = { edges: [], nodes: [] };
const dereferencedManifest: DereferencedManifest = {
  title: "Dereferenced Manifest",
  boards: [],
  manifests: [],
};
const localBoardReference: ReferencedBoard = {
  title: "Local Board Reference",
  url: path.resolve(import.meta.dirname, "board.bgl.json"),
};
const remoteBoardReference: ReferencedBoard = {
  title: "Remote Board Reference",
  url: "https://example.com/board.bgl.json",
};
const localManifestReference: ReferencedManifest = {
  title: "Local Manifest Reference",
  url: path.resolve(import.meta.dirname, "manifest.bbm.json"),
};
const remoteManifestReference: ReferencedManifest = {
  title: "Remote Manifest Reference",
  url: "https://example.com/manifest.bbm.json",
};

const fixtures: BreadboardManifest[] = [
  { title: "Empty manifest" },
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
        version: "1.0.0",
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
            version: "1.0.0",
          },
        ],
        manifests: [
          {
            title: "Nested Nested Nested Manifest",
            boards: [
              {
                title: "My First Board",
                url: "https://gist.githubusercontent.com/user/SOME_ID/raw/board.bgl.json",
                version: "1.0.0",
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
  dereferencedManifest,
  localManifestReference,
  remoteManifestReference,
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
        console.error(t.name, { errors });
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
    type: "remote" | "local" | "dereferenced";
  };

  const dereferenceTests: TestDefinition[] = [
    {
      name: "remote manifest",
      type: "remote",
      reference: remoteManifestReference,
      expected: dereferencedManifest,
    },
    {
      name: "local manifest",
      reference: localManifestReference,
      expected: dereferencedManifest,
      type: "local",
    },
    {
      name: "dereferenced manifest",
      reference: dereferencedManifest,
      expected: dereferencedManifest,
      type: "dereferenced",
    },
    {
      name: "remote board",
      reference: remoteBoardReference,
      expected: dereferencedBoard,
      type: "remote",
    },
    {
      name: "local board",
      reference: localBoardReference,
      expected: dereferencedBoard,
      type: "local",
    },
    {
      name: "dereferenced board",
      reference: dereferencedBoard,
      expected: dereferencedBoard,
      type: "dereferenced",
    },
  ];

  describe("dereference", () => {
    dereferenceTests.forEach(
      ({ name, reference, expected, type }: TestDefinition) => {
        test(`${name} reference should be dereferenced correctly`, async () => {
          mockResponse(type, expected, reference);
          const dereferenced = await dereference(reference);
          assert.ok(dereferenced);
          assert.deepEqual(dereferenced, expected);
          resetMocks(type, reference);
        });
      }
    );
  });

  describe("dereferenceBoard", () => {
    test("should return a DereferencedBoard object", async () => {
      mockFetchResponse(dereferencedBoard);
      const dereferenced = await dereferenceBoard(remoteBoardReference);
      assert.ok(isDereferencedBoard(dereferenced));
      assert.deepEqual(dereferenced, dereferencedBoard);
      mock.reset();
    });
  });

  describe("dereferenceManifest", () => {
    test("should return a DereferencedManifest object", async () => {
      mockFetchResponse(dereferencedManifest);
      const dereferenced = await dereferenceManifest(remoteManifestReference);
      assert.ok(isDereferencedManifest(dereferenced));
      assert.deepEqual(dereferenced, dereferencedManifest);
      mock.reset();
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

  mock.reset();
});

function mockResponse(
  type: string,
  expected: DereferencedBoard | DereferencedManifest,
  reference: Resource
) {
  if (type === "remote") {
    mockFetchResponse(expected);
  } else if (type === "local") {
    fs.writeFileSync(
      (reference as ResourceReference).url,
      JSON.stringify(expected)
    );
  }
}

function mockFetchResponse(obj: any) {
  mock.method(global, "fetch", () => ({
    then: () => obj,
    status: 200,
  }));
}

function resetMocks(type: string, reference: Resource) {
  if (type === "local") {
    fs.unlinkSync((reference as ResourceReference).url);
  } else if (type === "remote") {
    mock.reset();
  }
}
