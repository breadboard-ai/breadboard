/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { describe } from "node:test";

import { deepStrictEqual, ok } from "node:assert";
import { RemoteRunner } from "../../../src/harness/remote-runner.js";
import { GraphDescriptor, OutputResponse } from "../../../src/index.js";
import {
  EventLogEntry,
  eventNamesFromLog,
  logEvents,
  mockFetch,
  queryLog,
} from "./test-utils.js";

import askForSecret from "../../bgl/ask-for-secret.bgl.json" with { type: "json" };
import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import multiLevelInvoke from "../../bgl/multi-level-invoke.bgl.json" with { type: "json" };

const BGL_DIR = new URL("../../../tests/bgl/test.bgl.json", import.meta.url)
  .href;

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
        "edge",
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
        "edge",
        "nodestart",
        "input",
        "pause",
        "resume",
        "nodeend",
        "edge",
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

  test("multi-level invoke graph with diagnostics", async () => {
    const events: EventLogEntry[] = [];
    const graph = multiLevelInvoke as GraphDescriptor;
    graph.url = BGL_DIR;
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
      mockFetch(graph)
    );
    logEvents(runner, events);
    {
      const result = await runner.run();
      ok(!result);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "start",
        "graphstart",
        "edge",
        "nodestart",
        "graphstart",
        "edge",
        "nodestart",
        "input",
        "pause",
      ]);
    }
    {
      events.length = 0;
      const result = await runner.run({ name: "Bob" });
      ok(!result);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "resume",
        "nodeend",
        "edge",
        "nodestart",
        "graphstart",
        "edge",
        "nodestart",
        "input",
        "pause",
      ]);
    }
    {
      events.length = 0;
      const result = await runner.run({ location: "Neptune" });
      ok(result);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "resume",
        "nodeend",
        "edge",
        "nodestart",
        "nodeend",
        "edge",
        "edge",
        "nodestart",
        "nodeend",
        "graphend",
        "nodeend",
        "edge",
        "nodestart",
        "nodeend",
        "edge",
        "nodestart",
        "nodeend",
        "graphend",
        "nodeend",
        "edge",
        "nodestart",
        "output",
        "nodeend",
        "graphend",
        "end",
      ]);
      const output = queryLog(events, "output") as OutputResponse;
      deepStrictEqual(output.outputs, {
        greeting: 'Greeting is: "Hello, Bob from Neptune!"',
      });
    }
  });

  test("correctly handles secret inputs", async () => {
    const events: EventLogEntry[] = [];
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
      mockFetch(askForSecret as GraphDescriptor)
    );
    logEvents(runner, events);
    {
      const result = await runner.run();
      ok(result);
      ok(!runner.running());
      deepStrictEqual(eventNamesFromLog(events), [
        "start",
        "graphstart",
        "edge",
        "nodestart",
        "nodeend",
        "graphend",
        "end",
      ]);
    }
  });
});
