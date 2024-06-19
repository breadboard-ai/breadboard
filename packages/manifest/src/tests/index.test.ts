/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import * as assert from "node:assert";
import test, { beforeEach, describe, mock } from "node:test";
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

const dereferencedBoard: DereferencedBoard = {
  edges: [],
  nodes: [],
};

const dereferencedManifest: DereferencedManifest = {
  boards: [],
  manifests: [],
};

const localBoardReference: ReferencedBoard = {
  url: path.resolve(import.meta.dirname, "board.bgl.json"),
};

const remoteBoardReference: ReferencedBoard = {
  url: "https://example.com/board.bgl.json",
};

const localManifestReference: ReferencedManifest = {
  url: path.resolve(import.meta.dirname, "manifest.bbm.json"),
};

const remoteManifestReference: ReferencedManifest = {
  url: "https://example.com/manifest.bbm.json",
};

const fixtures: BreadboardManifest[] = [
  {},
  { title: "Empty manifest" },
  { title: "Manifest with an empty boards array", boards: [] },
  { title: "Manifest with an empty manifests array", manifests: [] },
  {
    title: "Manifest with empty boards and manifests arrays",
    boards: [],
    manifests: [
      {
        title: "Gist Manifest",
        // boards: [],
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
      {
        title: "My Second Board",
        url: "./boards/board.bgl.json",
      },
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
      {
        title: "My Second Board",
        url: "./boards/board.bgl.json",
      },
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
    boards: [dereferencedBoard],
  },
  {
    boards: [localBoardReference],
  },
  {
    boards: [remoteBoardReference],
  },
  {
    boards: [dereferencedBoard, localBoardReference, remoteBoardReference],
  },
  dereferencedManifest,
  localManifestReference,
  remoteManifestReference,
  {
    manifests: [dereferencedManifest],
  },
  {
    manifests: [localManifestReference],
  },
  {
    manifests: [remoteBoardReference],
  },
  {
    manifests: [
      dereferencedManifest,
      localManifestReference,
      remoteManifestReference,
    ],
  },
];

for (const manifest of fixtures) {
  const index = fixtures.indexOf(manifest);
  test(
    [`Manifest ${index + 1}/${fixtures.length}`, manifest.title]
      .filter(Boolean)
      .join(": "),
    async () => {
      const valid = validate(manifest);
      assert.ok(valid);
    }
  );
  console.debug();
}

describe("BreadboardManifest", () => {
  beforeEach(() => {});

  describe("isBglLike", () => {
    test("should return true for a BGL-like object", () =>
      assert.ok(isBglLike(dereferencedBoard)));
    test("should return false for a non-BGL-like object", () =>
      assert.ok(!isBglLike(dereferencedManifest)));
  });

  describe("isDereferencedManifest", () => {
    describe("should return true for a DereferencedManifest object", () => {
      test("with boards array", () =>
        assert.ok(
          isDereferencedManifest({
            boards: [],
          })
        ));
      test("with manifests array", () =>
        assert.ok(
          isDereferencedManifest({
            manifests: [],
          })
        ));
    });

    test("should return false for a non-DereferencedManifest object", () =>
      assert.ok(!isDereferencedManifest(dereferencedBoard)));
  });

  describe("isRemoveUri", () => {
    test("should return true for a remote URI", () =>
      assert.ok(isRemoteUri("https://example.com")));

    test("should return false for a local URI", () =>
      assert.ok(!isRemoteUri("./path/to/file")));
  });

  describe("isLocalUri", () => {
    test("should return true for a local URI", () =>
      assert.ok(isLocalUri("./path/to/file")));

    test("should return false for a remote URI", () =>
      assert.ok(!isLocalUri("https://example.com")));
  });

  describe("isResourceReference", () => {
    test("local manifest reference", () =>
      assert.ok(isResourceReference(localManifestReference)));
    test("remote manifest reference", () =>
      assert.ok(isResourceReference(remoteManifestReference)));
    test("local board reference", () =>
      assert.ok(isResourceReference(localBoardReference)));
    test("remote board reference", () =>
      assert.ok(isResourceReference(remoteBoardReference)));

    test("dereferenced manifest", () =>
      assert.ok(!isResourceReference(dereferencedManifest)));

    test("dereferenced board", () =>
      assert.ok(!isResourceReference(dereferencedBoard)));
  });

  describe("isRemoteResource", () => {
    test("local manifest reference", () =>
      assert.ok(!isRemoteResource(localManifestReference)));

    test("remote manifest reference", () =>
      assert.ok(isRemoteResource(remoteManifestReference)));

    test("local board reference", () =>
      assert.ok(!isRemoteResource(localBoardReference)));

    test("remote board reference", () =>
      assert.ok(isRemoteResource(remoteBoardReference)));

    test("dereferenced manifest", () =>
      assert.ok(!isRemoteResource(dereferencedManifest)));

    test("dereferenced board", () =>
      assert.ok(!isRemoteResource(dereferencedBoard)));
  });

  describe("isLocalResource", () => {
    test("local manifest reference", () =>
      assert.ok(isLocalResource(localManifestReference)));

    test("remote manifest reference", () =>
      assert.ok(!isLocalResource(remoteManifestReference)));

    test("dereferenced manifest", () =>
      assert.ok(!isLocalResource(dereferencedManifest)));

    test("dereferenced board", () =>
      assert.ok(!isLocalResource(dereferencedBoard)));
  });

  describe("isDereferencedBoard", () => {
    test("dereferenced board", () =>
      assert.ok(isDereferencedBoard(dereferencedBoard)));

    test("dereferenced manifest", () =>
      assert.ok(!isDereferencedBoard(dereferencedManifest)));
  });

  describe("dereference", (t) => {
    describe("manifest", () => {
      test("remote manifest reference", async () => {
        mockFetchResponse(dereferencedManifest);
        const dereferenced = await dereference(remoteManifestReference);
        assert.ok(dereferenced);
        assert.deepEqual(dereferenced, dereferencedManifest);
        mock.reset();
      });

      test("local manifest reference", async (t) => {
        fs.writeFileSync(
          localManifestReference.url,
          JSON.stringify(dereferencedManifest)
        );
        mockFetchResponse(dereferencedManifest);
        const dereferenced = await dereference(localManifestReference);
        assert.ok(dereferenced);
        assert.deepEqual(dereferenced, dereferencedManifest);
        mock.reset();

        fs.unlinkSync(localManifestReference.url);
      });

      test("manifest object", async () => {
        const dereferenced = await dereference(dereferencedManifest);
        assert.ok(dereferenced);
        assert.deepEqual(dereferenced, dereferencedManifest);
      });
    });

    describe("board", () => {
      test("remote board reference", async () => {
        mockFetchResponse(dereferencedBoard);
        const dereferenced = await dereference(remoteBoardReference);
        assert.ok(dereferenced);
        assert.ok(isDereferencedBoard(dereferenced));
        assert.deepEqual(dereferenced, dereferencedBoard);
        mock.reset();
      });

      test("local board reference", async () => {
        fs.writeFileSync(
          localBoardReference.url,
          JSON.stringify(dereferencedBoard)
        );
        mockFetchResponse(dereferencedBoard);
        const dereferenced = await dereference(localBoardReference);
        assert.ok(dereferenced);
        assert.ok(isDereferencedBoard(dereferenced));
        assert.deepEqual(dereferenced, dereferencedBoard);
        mock.reset();

        fs.unlinkSync(localBoardReference.url);
      });

      test("board object", async () => {
        const dereferenced = await dereference(dereferencedBoard);
        assert.ok(dereferenced);
        assert.ok(isDereferencedBoard(dereferenced));
        assert.deepEqual(dereferenced, dereferencedBoard);
      });
    });

    test("should return a DereferencedManifest object", async () => {
      mockFetchResponse(dereferencedManifest);
      const dereferenced = await dereference(remoteManifestReference);
      assert.ok(isDereferencedManifest(dereferenced));
      assert.deepEqual(dereferenced, dereferencedManifest);
      mock.reset();
    });
  });
  describe("dereferenceBoard", (t) => {
    test("should return a DereferencedBoard object", async () => {
      mockFetchResponse(dereferencedBoard);
      const dereferenced = await dereferenceBoard(remoteBoardReference);
      assert.ok(isDereferencedBoard(dereferenced));
      assert.deepEqual(dereferenced, dereferencedBoard);
      mock.reset();
    });
  });
  describe("dereferenceManifest", (t) => {
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
    json: () => ({
      key: "value",
    }),
    status: 200,
  }));
  const response = await fetch("foo");
  assert.strictEqual(response.status, 200);

  const responseJson = await response.json();
  assert.strictEqual(responseJson.key, "value");

  mock.reset();
});

function mockFetchResponse(obj: any) {
  mock.method(global, "fetch", () => ({
    then: () => obj,
    status: 200,
  }));
}
