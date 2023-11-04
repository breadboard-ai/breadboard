/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, test } from "vitest";

import {
  generateToken,
  secretReplacer,
  secretScanner,
} from "../src/secrets.js";

test("generateToken produces a reasonable token", async () => {
  const token = generateToken();
  expect(token).toMatch(/^[0-9a-f]{12}$/);
});

test("secretReplacer finds all tokens", async () => {
  const secrets = {
    "123456789abc": "fooValue",
    "123456789def": "barValue",
  };
  const value = "foo:PROXIED_123456789abc, bar:PROXIED_123456789def";
  const replaced = secretReplacer(value, secrets);
  expect(replaced).toBe("foo:fooValue, bar:barValue");
});

test("secretReplacer does not replace non-secret values", async () => {
  const secrets = {
    "123456789abc": "fooValue",
    "123456789def": "barValue",
  };
  const value = "foo:PROXIED_123456789abc, bar:PROXIED_123456789xyz";
  const replaced = secretReplacer(value, secrets);
  expect(replaced).toBe("foo:fooValue, bar:PROXIED_123456789xyz");
});

test("secretReplacer works with nested objects", async () => {
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
  expect(replaced).toEqual({
    foo: ["fooValue"],
    bar: {
      baz: "barValue",
    },
  });
});

test("secretScanner finds all secrets", async () => {
  const value = "foo:PROXIED_123456789abc, bar:PROXIED_123456789def";
  const tokens = secretScanner(value);
  expect(tokens).toEqual(["123456789abc", "123456789def"]);
});
