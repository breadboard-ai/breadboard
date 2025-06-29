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
  replaceTunnelledInputs,
  scanTunnelValue,
  atob,
  btoa,
} from "../../../src/remote/tunnel.js";
import { callHandler } from "../../../src/handler.js";
import { NodeHandlers } from "@breadboard-ai/types";

test("atob and btoa polyfills work", (t) => {
  t.is(atob("aGVsbG8gd29ybGQ="), "hello world");
  t.is(btoa("hello world"), "aGVsbG8gd29ybGQ=");
  t.is(atob(btoa("hello world")), "hello world");
});

test("readNodeSpec works as advertised", (t) => {
  const output = readNodeSpec("secrets", {
    foo: "bar",
    bar: ["foo", "baz"],
    baz: { to: "foo", when: { foo: "bar" } },
    qux: [
      { to: "foo", when: { foo: "bar" } },
      { to: "baz", when: { foo: "foo" } },
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
    kits: [],
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

test("replaceInputs works as advertised", async (t) => {
  {
    const result = await replaceInputs(
      {
        url: "https://example.com",
        foo: "bar",
      },
      [
        new NodeTunnel("unused", "unused", "unused", {
          url: "https://example2.com",
        }),
      ],
      async (value, allow) => (allow ? `REPLACE=${value}` : "BLOCKED")
    );
    t.deepEqual(result, {
      url: "BLOCKED",
      foo: "BLOCKED",
    });
  }
  {
    const result = await replaceInputs(
      {
        url: "https://example.com",
        foo: "bar",
      },
      [
        new NodeTunnel("unused", "unused", "unused", {
          url: "https://example.com",
        }),
      ],
      async (value, allow) => (allow ? `REPLACE=${value}` : "BLOCKED")
    );
    t.deepEqual(result, {
      url: "REPLACE=https://example.com",
      foo: "REPLACE=bar",
    });
  }
  {
    const result = await replaceInputs(
      {
        url: "https://example.com",
        foo: "bar",
      },
      [
        new NodeTunnel("unused", "unused", "unused", {
          url: /example\.com/,
        }),
      ],
      async (value, allow) => (allow ? `REPLACE=${value}` : "BLOCKED")
    );
    t.deepEqual(result, {
      url: "REPLACE=https://example.com",
      foo: "REPLACE=bar",
    });
  }
  {
    const result = await replaceInputs(
      {
        url: "https://example.com",
        foo: "bar",
      },
      [
        new NodeTunnel("unused", "unused", "unused", {
          url: /example2\.com/,
        }),
      ],
      async (value, allow) => (allow ? `REPLACE=${value}` : "BLOCKED")
    );
    t.deepEqual(result, {
      url: "BLOCKED",
      foo: "BLOCKED",
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

test("createTunnelKit creates a kit that tunnels outputs to inputs", async (t) => {
  const handlers = {
    secrets: async (inputs) => {
      t.deepEqual(inputs, { keys: ["API_KEY"] });
      return { API_KEY: "<secret value>" };
    },
    fetch: async (inputs) => {
      t.deepEqual(inputs, { url: "<secret value>", method: "POST" });
      return { result: "fetch result" };
    },
  } satisfies NodeHandlers;
  const kit = createTunnelKit(
    {
      secrets: {
        API_KEY: [new NodeTunnel("API_KEY", "secrets", "fetch")],
      },
    },
    handlers
  );

  t.deepEqual(
    await callHandler(
      kit.handlers.fetch,
      {
        url: getTunnelValue("secrets", "API_KEY", { keys: ["API_KEY"] }),
        method: "POST",
      },
      {}
    ),
    {
      result: "fetch result",
    }
  );
});

test("createTunnelKit correctly blocks tunnels", async (t) => {
  {
    const handlers = {
      secrets: async (inputs) => {
        t.deepEqual(inputs, { keys: ["API_KEY"] });
        return { API_KEY: "<secret value>" };
      },
      fetch: async (inputs) => {
        t.deepEqual(inputs, { url: "VALUE_BLOCKED", method: "POST" });
        return { result: "fetch result" };
      },
    } satisfies NodeHandlers;
    const kit = createTunnelKit(
      {
        secrets: {
          API_KEY: [
            new NodeTunnel("API_KEY", "secrets", "fetch", {
              url: /example\.com/,
            }),
          ],
        },
      },
      handlers
    );

    t.deepEqual(
      await callHandler(
        kit.handlers.fetch,
        {
          url: getTunnelValue("secrets", "API_KEY", { keys: ["API_KEY"] }),
          method: "POST",
        },
        {}
      ),
      {
        result: "fetch result",
      }
    );
  }
  {
    const handlers = {
      secrets: async (inputs) => {
        t.deepEqual(inputs, { keys: ["API_KEY"] });
        return { API_KEY: "<secret value>" };
      },
      fetch: async (inputs) => {
        t.deepEqual(inputs, {
          url: "https://example.com/key=<secret value>",
          method: "POST",
        });
        return { result: "fetch result" };
      },
    } satisfies NodeHandlers;
    const kit = createTunnelKit(
      {
        secrets: {
          API_KEY: [
            new NodeTunnel("API_KEY", "secrets", "fetch", {
              url: /example\.com/,
            }),
          ],
        },
      },
      handlers
    );

    t.deepEqual(
      await callHandler(
        kit.handlers.fetch,
        {
          url: `https://example.com/key=${getTunnelValue("secrets", "API_KEY", {
            keys: ["API_KEY"],
          })}`,
          method: "POST",
        },
        {}
      ),
      {
        result: "fetch result",
      }
    );
  }
});

test("createTunnelKit correctly tunnels multiple inputs", async (t) => {
  {
    const handlers = {
      secrets: async () => {
        return {
          API_KEY: "<secret value>",
          ANOTHER_KEY: "<another secret value>",
        };
      },
      fetch: async (inputs) => {
        t.deepEqual(inputs, {
          url: "https://example.com/key=<secret value>&another=<another secret value>",
          method: "POST",
        });
        return { result: "fetch result" };
      },
    } satisfies NodeHandlers;
    const kit = createTunnelKit(
      {
        secrets: {
          API_KEY: [new NodeTunnel("API_KEY", "secrets", "fetch")],
          ANOTHER_KEY: [new NodeTunnel("ANOTHER_KEY", "secrets", "fetch")],
        },
      },
      handlers
    );

    t.deepEqual(
      await callHandler(
        kit.handlers.fetch,
        {
          url: `https://example.com/key=${getTunnelValue("secrets", "API_KEY", {
            keys: ["API_KEY"],
          })}&another=${getTunnelValue("secrets", "ANOTHER_KEY", {
            keys: ["ANOTHER_KEY"],
          })}`,
          method: "POST",
        },
        {}
      ),
      {
        result: "fetch result",
      }
    );
  }
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
      someNodeThatUsesAPIKey: [
        new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
      ],
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
      someNodeThatUsesAPIKey: [
        new NodeTunnel("API_KEY", "secrets", "someNodeThatUsesAPIKey"),
        new NodeTunnel("ANOTHER_KEY", "secrets", "someNodeThatUsesAPIKey"),
      ],
    });
  }
});

test("createDestinationMap can handle tunnel collisions", (t) => {
  const output = createDestinationMap({
    secrets: {
      API_KEY: [
        new NodeTunnel("API_KEY", "secrets", "fetch", {
          url: /www.googleapis.com\/customsearch\/v1/,
        }),
      ],
      GOOGLE_CSE_ID: [
        new NodeTunnel("GOOGLE_CSE_ID", "secrets", "fetch", {
          url: /www.googleapis.com\/customsearch\/v1/,
        }),
      ],
    },
  });
  t.deepEqual(output, {
    fetch: [
      new NodeTunnel("API_KEY", "secrets", "fetch", {
        url: /www.googleapis.com\/customsearch\/v1/,
      }),
      new NodeTunnel("GOOGLE_CSE_ID", "secrets", "fetch", {
        url: /www.googleapis.com\/customsearch\/v1/,
      }),
    ],
  });
});

test("scanTunnelValue works as advertised", (t) => {
  const tunnelValue = getTunnelValue("nodeType", "outputName", {
    inputName: "inputValue",
  });
  t.deepEqual(scanTunnelValue(`HELLO${tunnelValue}WORLD`), [
    { value: "HELLO" },
    {
      nodeType: "nodeType",
      outputName: "outputName",
      inputs: '{"inputName":"inputValue"}',
    },
    { value: "WORLD" },
  ]);
  t.deepEqual(scanTunnelValue(`HELLO${tunnelValue}`), [
    { value: "HELLO" },
    {
      nodeType: "nodeType",
      outputName: "outputName",
      inputs: '{"inputName":"inputValue"}',
    },
  ]);
  t.deepEqual(scanTunnelValue(`${tunnelValue}WORLD`), [
    {
      nodeType: "nodeType",
      outputName: "outputName",
      inputs: '{"inputName":"inputValue"}',
    },
    { value: "WORLD" },
  ]);
  t.deepEqual(scanTunnelValue(tunnelValue), [
    {
      nodeType: "nodeType",
      outputName: "outputName",
      inputs: '{"inputName":"inputValue"}',
    },
  ]);
  t.deepEqual(scanTunnelValue(""), []);
  t.deepEqual(scanTunnelValue("HELLO WORLD"), [{ value: "HELLO WORLD" }]);
});

test("replaceTunnelledInputs correctly round-trips objects", async (t) => {
  const output = await replaceTunnelledInputs(
    {
      url: "https://example.com",
      foo: "bar",
    },
    false,
    async (_, inputs) => {
      return inputs;
    }
  );
  t.deepEqual(output, {
    url: "https://example.com",
    foo: "bar",
  });
});

test("replaceTunnelledInputs correctly replaces values in string inputs", async (t) => {
  {
    const output = await replaceTunnelledInputs(
      `HELLO ${getTunnelValue("secrets", "API_KEY", {
        API_KEY: ["API_KEY"],
      })} WORLD`,
      true,
      async (_, inputs) => {
        t.deepEqual(inputs, { API_KEY: ["API_KEY"] });
        return inputs;
      }
    );
    t.deepEqual(output, `HELLO ["API_KEY"] WORLD`);
  }
  {
    const output = await replaceTunnelledInputs(
      `HELLO ${getTunnelValue("secrets", "API_KEY", {
        API_KEY: ["API_KEY"],
      })} WORLD`,
      true,
      async (_, inputs) => {
        t.deepEqual(inputs, { API_KEY: ["API_KEY"] });
        return {
          API_KEY: "<secret value>",
        };
      }
    );
    t.deepEqual(output, `HELLO <secret value> WORLD`);
  }
});

test("replaceTunnelledInputs correctly replaces values in object inputs", async (t) => {
  {
    const output = await replaceTunnelledInputs(
      {
        value: `HELLO ${getTunnelValue("secrets", "API_KEY", {
          API_KEY: ["API_KEY"],
        })} WORLD`,
      },
      true,
      async (_, inputs) => {
        t.deepEqual(inputs, { API_KEY: ["API_KEY"] });
        return {
          API_KEY: "<secret value>",
        };
      }
    );
    t.deepEqual(output, { value: `HELLO <secret value> WORLD` });
  }
  {
    const output = await replaceTunnelledInputs(
      [
        `HELLO ${getTunnelValue("secrets", "API_KEY", {
          API_KEY: ["API_KEY"],
        })} WORLD`,
      ],
      true,
      async (_, inputs) => {
        t.deepEqual(inputs, { API_KEY: ["API_KEY"] });
        return {
          API_KEY: "<secret value>",
        };
      }
    );
    t.deepEqual(output, [`HELLO <secret value> WORLD`]);
  }
});

test("replaceTunnelledInputs correctly replaces multiple values", async (t) => {
  {
    const output = await replaceTunnelledInputs(
      {
        value: `HELLO ${getTunnelValue("secrets", "API_KEY", {
          API_KEY: ["API_KEY"],
        })} WORLD`,
        also: getTunnelValue("secrets", "ANOTHER_KEY", {
          ANOTHER_KEY: ["ANOTHER_KEY"],
        }),
      },
      true,
      async () => {
        return {
          API_KEY: "<secret value>",
          ANOTHER_KEY: "<another secret value>",
        };
      }
    );
    t.deepEqual(output, {
      value: `HELLO <secret value> WORLD`,
      also: "<another secret value>",
    });
  }
});
