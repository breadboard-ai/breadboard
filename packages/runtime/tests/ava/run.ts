/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { replacer, reviver } from "../../src/serialization.js";

test("replacer correctly serializes Maps", async (t) => {
  t.is(JSON.stringify({}, replacer), "{}");
  t.is(JSON.stringify("string", replacer), '"string"');
  t.is(JSON.stringify(42, replacer), "42");
  t.is(
    JSON.stringify(new Map([["foo", "bar"]]), replacer),
    '{"$type":"Map","value":[["foo","bar"]]}'
  );
  t.is(
    JSON.stringify(new Map([["foo", new Map([["bar", "baz"]])]]), replacer),
    '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}'
  );
});

test("reviver correctly deserializes maps", async (t) => {
  t.deepEqual(JSON.parse("{}", reviver), {});
  t.deepEqual(JSON.parse('"string"', reviver), "string");
  t.deepEqual(JSON.parse("42", reviver), 42);
  t.deepEqual(
    JSON.parse('{"$type":"Map","value":[["foo","bar"]]}', reviver),
    new Map([["foo", "bar"]])
  );
  t.deepEqual(
    JSON.parse(
      '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}',
      reviver
    ),
    new Map([["foo", new Map([["bar", "baz"]])]])
  );
});
