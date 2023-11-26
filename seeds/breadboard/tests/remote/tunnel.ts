/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  Vault,
  Tunnel,
  getProtectedValue,
  readSpec,
  replaceInputs,
  replaceOutputs,
} from "../../src/remote/tunnel.js";

test("readSpec works as advertised", (t) => {
  const output = readSpec({
    foo: "bar",
    bar: ["foo", "baz"],
    baz: { to: "foo", inputs: { foo: "bar" } },
    qux: [
      { to: "foo", inputs: { foo: "bar" } },
      { to: "baz", inputs: { foo: "foo" } },
    ],
  });
  t.deepEqual(output, {
    foo: [new Tunnel("foo", "bar")],
    bar: [new Tunnel("bar", "foo"), new Tunnel("bar", "baz")],
    baz: [new Tunnel("baz", "foo", { foo: "bar" })],
    qux: [
      new Tunnel("qux", "foo", { foo: "bar" }),
      new Tunnel("qux", "baz", { foo: "foo" }),
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
      foo: [new Tunnel("foo", "bar")],
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
        foo: [new Tunnel("foo", "fetch", { url: "https://example2.com" })],
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
        foo: [new Tunnel("foo", "fetch", { url: "https://example.com" })],
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
        foo: [new Tunnel("foo", "fetch", { url: /example\.com/ })],
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
        url: [new Tunnel("url", "fetch", { url: /example\.com/ })],
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
    test: [new Tunnel("test", "bar")],
  });
  const protectedValue = getProtectedValue("secrets", "test");
  const result = vault.protectOutputs({ test: "value", foo: "bar" });
  t.deepEqual(result, { test: protectedValue, foo: "bar" });
});
