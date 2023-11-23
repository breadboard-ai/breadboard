/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { HTTPServerTransport } from "../../src/remote/http.js";
import { RunServer } from "../../src/remote/server.js";
import {
  AnyRunRequestMessage,
  AnyRunResponseMessage,
} from "../../src/remote/protocol.js";
import { Board } from "../../src/board.js";
import { TestKit } from "../helpers/_test-kit.js";

test("HTTPServerTransport does the basics", async (t) => {
  const request = {
    body: ["run", {}],
  };
  const response = {
    write: (response: unknown) => {
      t.deepEqual(response, ["input", { node: { type: "input" } }]);
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const stream = transport.createServerStream();
  const writer = stream.writableResponses.getWriter();
  const reader = stream.readableRequests.getReader();
  const requestValue = await reader.read();
  t.false(requestValue.done);
  const doneValue = await reader.read();
  t.true(doneValue.done);
  t.deepEqual(requestValue.value, ["run", {}]);
  writer.write(["input", { node: { type: "input" } }]);
  writer.close();
});

test("RunServer can use HTTPServerTransport", async (t) => {
  const board = new Board();
  const kit = board.addKit(TestKit);
  board.input({ foo: "bar" }).wire("*", kit.noop().wire("*", board.output()));

  const request = {
    body: ["run", {}] as AnyRunRequestMessage,
  };
  const response = {
    write: (response: AnyRunResponseMessage) => {
      t.like(response, ["input", { node: { type: "input" } }]);
      return true;
    },
    end: () => {
      t.pass();
    },
  };
  const transport = new HTTPServerTransport(request, response);
  const server = new RunServer(transport);
  await server.serve(board);
});
