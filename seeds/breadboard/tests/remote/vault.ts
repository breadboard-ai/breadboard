/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  Vault,
  VaultMatch,
  getProtectedValue,
  readSpec,
  replaceInputs,
  replaceOutputs,
} from "../../src/remote/vault.js";

test("readSpec works as advertised", (t) => {
  const output = readSpec({
    foo: "bar",
    bar: ["foo", "baz"],
    baz: { receiver: "foo", inputs: { foo: "bar" } },
    qux: [
      { receiver: "foo", inputs: { foo: "bar" } },
      { receiver: "baz", inputs: { foo: "foo" } },
    ],
  });
  t.deepEqual(output, {
    foo: [new VaultMatch("foo", "bar")],
    bar: [new VaultMatch("bar", "foo"), new VaultMatch("bar", "baz")],
    baz: [new VaultMatch("baz", "foo", { foo: "bar" })],
    qux: [
      new VaultMatch("qux", "foo", { foo: "bar" }),
      new VaultMatch("qux", "baz", { foo: "foo" }),
    ],
  });
});

test("replaceOutputs works as advertised", (t) => {
  const output = replaceOutputs(
    {
      foo: "value here",
      bar: "baz",
    },
    {
      foo: [new VaultMatch("foo", "bar")],
    },
    (name, value) => `${name}=${value}`
  );
  t.deepEqual(output, {
    foo: "foo=value here",
    bar: "baz",
  });
});

test("replaceInputs works as advertised", (t) => {
  {
    const result = replaceInputs(
      "fetch",
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        foo: [new VaultMatch("foo", "fetch", { url: "https://example2.com" })],
      },
      (name, value) => `${name}=${value}`
    );
    t.deepEqual(result, {
      url: "https://example.com",
      foo: "bar",
    });
  }
  {
    const result = replaceInputs(
      "fetch",
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        foo: [new VaultMatch("foo", "fetch", { url: "https://example.com" })],
      },
      (name, value) => `${name}=${value}`
    );
    t.deepEqual(result, {
      url: "https://example.com",
      foo: "foo=bar",
    });
  }
  {
    const result = replaceInputs(
      "fetch",
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        foo: [new VaultMatch("foo", "fetch", { url: /example\.com/ })],
      },
      (name, value) => `${name}=${value}`
    );
    t.deepEqual(result, {
      url: "https://example.com",
      foo: "foo=bar",
    });
  }
  {
    const result = replaceInputs(
      "fetch",
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        url: [new VaultMatch("url", "fetch", { url: /example\.com/ })],
      },
      (name, value) => `${name}=${value}`
    );
    t.deepEqual(result, {
      url: "url=https://example.com",
      foo: "bar",
    });
  }
});

test("Vault correctly protects outputs", (t) => {
  const vault = new Vault("secrets", {
    test: [new VaultMatch("test", "bar")],
  });
  const protectedValue = getProtectedValue("secrets", "test");
  const result = vault.protectOutputs({ test: "value", foo: "bar" });
  t.deepEqual(result, { test: protectedValue, foo: "bar" });
});
