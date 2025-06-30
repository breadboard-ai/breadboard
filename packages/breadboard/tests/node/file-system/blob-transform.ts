/* eslint-disable @typescript-eslint/no-unused-expressions */
/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import { good, makeDataCx } from "../test-file-system.js";
import { transformBlobs } from "../../../src/file-system/blob-transform.js";
import { deepStrictEqual } from "node:assert";
import { InlineDataCapabilityPart } from "@breadboard-ai/types";

describe("File System Blob Transform", () => {
  it("runs a no-op transform", async () => {
    const foo = makeDataCx(["foo"]);
    const result = await transformBlobs("/tmp/foo", foo, []);
    good(result) && deepStrictEqual(result, foo);
  });

  it("invokes transformers", async () => {
    const log: { part: InlineDataCapabilityPart; path: string }[] = [];
    const foo = makeDataCx(["foo", "bar"], ["baz"]);
    const result = await transformBlobs("/tmp/foo", foo, [
      {
        async transform(path, part) {
          const inline = part as InlineDataCapabilityPart;
          log.push({ part: inline, path });
          return inline;
        },
      },
    ]);
    good(result) && deepStrictEqual(result, foo);
    deepStrictEqual(log, [
      {
        part: { inlineData: { mimeType: "text/plain", data: "foo" } },
        path: "/tmp/foo",
      },
      {
        part: { inlineData: { mimeType: "text/plain", data: "bar" } },
        path: "/tmp/foo",
      },
      {
        part: { inlineData: { mimeType: "text/plain", data: "baz" } },
        path: "/tmp/foo",
      },
    ]);
  });

  it("pipelines transformers", async () => {
    const foo = makeDataCx(["foo", "bar"], ["baz"]);
    const transfomer = async (_: string, part: InlineDataCapabilityPart) => {
      const data = `${part.inlineData.data}!`;
      return { inlineData: { ...part.inlineData, data } };
    };
    const result = await transformBlobs("/tmp/foo", foo, [
      {
        transform: transfomer,
      },
      {
        transform: transfomer,
      },
    ]);
    good(result) &&
      deepStrictEqual(result, makeDataCx(["foo!!", "bar!!"], ["baz!!"]));
  });
});
