/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import {
  generateToken,
  secretReplacer,
  secretScanner,
} from "../../src/harness/secrets.js";

test("generateToken produces a reasonable token", async (t) => {
  const token = generateToken();
  t.regex(token, /^[0-9a-f]{12}$/);
});

test("secretReplacer finds all tokens", async (t) => {
  const secrets = {
    "123456789abc": "fooValue",
    "123456789def": "barValue",
  };
  const value = "foo:PROXIED_123456789abc, bar:PROXIED_123456789def";
  const replaced = secretReplacer(value, secrets);
  t.is(replaced, "foo:fooValue, bar:barValue");
});

test("secretReplacer does not replace non-secret values", async (t) => {
  const secrets = {
    "123456789abc": "fooValue",
    "123456789def": "barValue",
  };
  const value = "foo:PROXIED_123456789abc, bar:PROXIED_123456789xyz";
  const replaced = secretReplacer(value, secrets);
  t.is(replaced, "foo:fooValue, bar:PROXIED_123456789xyz");
});

test("secretReplacer works with nested objects", async (t) => {
  const secrets = {
    "123456789abc": "fooValue",
    "123456789def": "barValue",
  };
  const value = {
    foo: ["PROXIED_123456789abc"],
    bar: {
      baz: "PROXIED_123456789def",
    },
  };
  const replaced = secretReplacer(value, secrets);
  t.deepEqual(replaced, {
    foo: ["fooValue"],
    bar: {
      baz: "barValue",
    },
  });
});

test("secretScanner finds all secrets", async (t) => {
  const value = "foo:PROXIED_123456789abc, bar:PROXIED_123456789def";
  const tokens = secretScanner(value);
  t.deepEqual(tokens, ["123456789abc", "123456789def"]);
});
