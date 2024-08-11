/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";

import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { deepStrictEqual, fail, ok } from "node:assert";
import { RemoteRunner } from "../../../src/harness/remote-runner.js";
import {
  createDefaultDataStore,
  createLoader,
  OutputResponse,
} from "../../../src/index.js";
import { handleRunGraphRequest } from "../../../src/remote/run-graph-server.js";
import {
  RemoteMessage,
  RemoteRunRequestBody,
  ServerRunConfig,
} from "../../../src/remote/types.js";
import { testKit } from "../test-kit.js";
import {
  EventLogEntry,
  eventNamesFromLog,
  logEvents,
  queryLog,
} from "./test-utils.js";

import simple from "../../bgl/simple.bgl.json" with { type: "json" };

const mockFetch = (graph: GraphDescriptor) => {
  const result: typeof globalThis.fetch = async (request, init) => {
    const url = request as string;
    const { method, body } = init || {};
    if (method !== "POST") {
      fail("Only POST requests are supported by mockFetch.");
    }
    if (url !== "https://example.com/run") {
      fail(`Only "https://example.com/run" is supported by mockFetch.`);
    }
    if (!body) {
      fail("No body provided in request.");
    }
    const {
      $key,
      $next: next,
      $diagnostics: diagnostics,
      ...inputs
    } = JSON.parse(body as string) as RemoteRunRequestBody;

    console.log("🌻 body in mockFetch", body);

    if ($key !== "my-key") {
      fail(`Invalid key provided. Use "my-key".`);
    }

    const pipe = new TransformStream<RemoteMessage, string>({
      transform(message, controller) {
        controller.enqueue(`data: ${JSON.stringify(message)}\n\n`);
      },
    });

    const config: ServerRunConfig = {
      graph,
      url: import.meta.url,
      kits: [testKit],
      writer: pipe.writable.getWriter(),
      loader: createLoader(),
      dataStore: createDefaultDataStore(),
      stateStore: {
        async load(next?: string) {
          return next ? JSON.parse(next as string) : undefined;
        },
        async save(state) {
          return JSON.stringify(state);
        },
      },
    };

    handleRunGraphRequest({ inputs: inputs, next, diagnostics }, config);

    return new Response(pipe.readable.pipeThrough(new TextEncoderStream()));
  };
  return result;
};

describe("RemoteRunner", async () => {
  test("simple graph with no diagnostics", async () => {
    const events: EventLogEntry[] = [];

    const runner = new RemoteRunner(
      {
        remote: {
          type: "http",
          key: "my-key",
          url: "https://example.com/run",
        },
        url: import.meta.url,
      },
      mockFetch(simple)
    );
    logEvents(runner, events);
    {
      const result = await runner.run();
      ok(result == false);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), ["start", "input", "pause"]);
    }
    {
      const result = await runner.run({ text: "foo" });
      ok(result == true);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "start",
        "input",
        "pause",
        "resume",
        "output",
        "end",
      ]);
      const output = queryLog(events, "output") as OutputResponse;
      deepStrictEqual(output.outputs, { text: "foo" });
    }
  });

  test("simple graph with diagnostics", async () => {
    const events: [name: string, data: unknown][] = [];
    const runner = new RemoteRunner(
      {
        remote: {
          type: "http",
          key: "my-key",
          url: "https://example.com/run",
        },
        url: import.meta.url,
        diagnostics: true,
      },
      mockFetch(simple)
    );
    logEvents(runner, events);
    {
      const result = await runner.run();
      ok(result == false);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "start",
        "graphstart",
        "nodestart",
        "input",
        "pause",
      ]);
    }
    {
      const result = await runner.run({ text: "foo" });
      ok(result == true);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "start",
        "graphstart",
        "nodestart",
        "input",
        "pause",
        "resume",
        "nodeend",
        "nodestart",
        "output",
        "nodeend",
        "graphend",
        "end",
      ]);
      const output = queryLog(events, "output") as OutputResponse;
      deepStrictEqual(output.outputs, { text: "foo" });
    }
  });
});
