/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { Board } from "../../src/board.js";
import {
  AnyProxyRequestMessage,
  AnyProxyResponseMessage,
} from "../../src/remote/protocol.js";
import { TestKit } from "../helpers/_test-kit.js";
import { HTTPServerTransport } from "../../src/remote/http.js";
import { ProxyServer } from "../../src/remote/server.js";

test("ProxyServer can use HTTPServerTransport", async (t) => {
  const board = new Board();
  board.addKit(TestKit);

  const request = {
    body: [
      "proxy",
      { node: { id: "id", type: "noop" }, inputs: { hello: "world" } },
    ] as AnyProxyRequestMessage,
  };
  const response = {
    write: (response: AnyProxyResponseMessage) => {
      t.deepEqual(response, ["proxy", { outputs: { hello: "world" } }]);
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const server = new ProxyServer(transport);
  await server.serve(board);
});
