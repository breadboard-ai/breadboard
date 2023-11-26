/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import {
  NodeTunnel,
  getTunnelValue,
  readNodeSpec,
  replaceInputs,
  replaceOutputs,
  readConfig,
  createTunnelKit,
  createDestinationMap,
} from "../../src/remote/tunnel.js";
import { BoardRunner } from "../../src/runner.js";
import { callHandler } from "../../src/handler.js";
import { NodeHandlers } from "../../src/types.js";

test("readNodeSpec works as advertised", (t) => {
  const output = readNodeSpec("secrets", {
    foo: "bar",
    bar: ["foo", "baz"],
    baz: { to: "foo", inputs: { foo: "bar" } },
    qux: [
      { to: "foo", inputs: { foo: "bar" } },
      { to: "baz", inputs: { foo: "foo" } },
    ],
  });
  t.deepEqual(output, {
    foo: [new NodeTunnel("foo", "secrets", "bar")],
    bar: [
      new NodeTunnel("bar", "secrets", "foo"),
      new NodeTunnel("bar", "secrets", "baz"),
    ],
    baz: [new NodeTunnel("baz", "secrets", "foo", { foo: "bar" })],
    qux: [
      new NodeTunnel("qux", "secrets", "foo", { foo: "bar" }),
      new NodeTunnel("qux", "secrets", "baz", { foo: "foo" }),
    ],
  });
});

test("readConfig works as advertised", (t) => {
  const output = readConfig({
    board: {} as BoardRunner,
    proxy: [
      "fetch",
      {
        node: "secrets",
        tunnel: {
          PALM_KEY: ["palm-generateText", "palm-embedText"],
        },
      },
    ],
  });
  t.deepEqual(output, {
    secrets: {
      PALM_KEY: [
        new NodeTunnel("PALM_KEY", "secrets", "palm-generateText"),
        new NodeTunnel("PALM_KEY", "secrets", "palm-embedText"),
      ],
    },
  });
});

test("replaceOutputs works as advertised", (t) => {
  const output = replaceOutputs(
    {
      foo: "value here",
      bar: "baz",
    },
    {
      foo: [new NodeTunnel("foo", "secrets", "bar")],
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
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        foo: new NodeTunnel("foo", "fetch", "fetch", {
          url: "https://example2.com",
        }),
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
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        foo: new NodeTunnel("foo", "fetch", "fetch", {
          url: "https://example.com",
        }),
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
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        foo: new NodeTunnel("foo", "fetch", "fetch", { url: /example\.com/ }),
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
      {
        url: "https://example.com",
        foo: "bar",
      },
      {
        url: new NodeTunnel("url", "fetch", "fetch", { url: /example\.com/ }),
      },
      (name, value) => `${name}=${value}`
    );
    t.deepEqual(result, {
      url: "url=https://example.com",
      foo: "bar",
    });
  }
});

test("createTunnelKit creates a kit that tunnels outputs", async (t) => {
  const handlers = {
    secrets: async () => {
      return { API_KEY: "<secret value>" };
    },
  } satisfies NodeHandlers;
  const kit = createTunnelKit(
    {
      secrets: {
        API_KEY: [
          new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
        ],
      },
    },
    handlers
  );
  t.deepEqual(await callHandler(handlers.secrets, {}, {}), {
    API_KEY: "<secret value>",
  });
  t.deepEqual(await callHandler(kit.handlers.secrets, {}, {}), {
    API_KEY: getTunnelValue("secrets", "API_KEY", {}),
  });
});

test("createDestinationMap works as advertised", (t) => {
  {
    const output = createDestinationMap({
      secrets: {
        API_KEY: [
          new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
        ],
      },
    });
    t.deepEqual(output, {
      someNodeThatUsesAPIKey: {
        API_KEY: new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
      },
    });
  }
  {
    const output = createDestinationMap({
      secrets: {
        API_KEY: [
          new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
        ],
        ANOTHER_KEY: [
          new NodeTunnel("ANOTHER_KEY", "secrets", "someNodeThatUsesAPIKey"),
        ],
      },
    });
    t.deepEqual(output, {
      someNodeThatUsesAPIKey: {
        API_KEY: new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
        ANOTHER_KEY: new NodeTunnel(
          "ANOTHER_KEY",
          "secrets",
          "someNodeThatUsesAPIKey"
        ),
      },
    });
  }
});
