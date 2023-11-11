/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { TestClient } from "../helpers/_test-transport.js";
import { RunResponseStream } from "../../src/remote/protocol.js";

test("Test transport interactions work", async (t) => {
  const clientTransport = new TestClient();
  clientTransport.setServer({
    load: async (request) => {
      return { title: "test", url: request.url };
    },
    run: async () => {
      const response = new ReadableStream({
        pull(controller) {
          controller.enqueue(["end", {}]);
          controller.close();
        },
      }) as RunResponseStream;
      return response;
    },
    proxy: async () => {
      return { outputs: {} };
    },
  });
  t.deepEqual(await clientTransport.load({ url: "hello", proxyNodes: [] }), {
    url: "hello",
    title: "test",
  });
  const response = await clientTransport.run(["run", {}]);
  const reader = response.getReader();
  t.deepEqual(await reader.read(), { done: false, value: ["end", {}] });
  t.deepEqual(await reader.read(), { done: true, value: undefined });
  t.deepEqual(
    await clientTransport.proxy({
      node: { id: "foo", type: "bar" },
      inputs: {},
    }),
    { outputs: {} }
  );
});
