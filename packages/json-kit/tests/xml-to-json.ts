/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepEqual } from "node:assert";
import test, { describe } from "node:test";
import xmlToJson from "../src/nodes/xml-to-json.js";
describe("xml-to-json", () => {
  test("xml-to-json can parse documents without processing instructions", async () => {
    const xml = `<foo><bar>baz</bar></foo>`;
    const expectedJson = {
      json: ["$doc", { foo: { bar: [{ $t: ["baz"] }] } }],
    };

    const json = await xmlToJson.invoke({ xml });
    deepEqual(json, expectedJson);
  });

  test("xml-to-json can parse documents with processing instructions", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><foo><bar>baz</bar></foo>`;
    const expectedJson = {
      json: ["$doc", { foo: { bar: [{ $t: ["baz"] }] } }],
    };

    const json = await xmlToJson.invoke({ xml });
    deepEqual(json, expectedJson);
  });

  test("xml-to-json can parse documents with two processing instructions", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet href="/blog/pretty-atom-feed-v3.xsl" type="text/xsl"?><foo><bar>baz</bar></foo>`;
    const expectedJson = {
      json: ["$doc", { foo: { bar: [{ $t: ["baz"] }] } }],
    };

    const json = await xmlToJson.invoke({ xml });
    deepEqual(json, expectedJson);
  });
});
