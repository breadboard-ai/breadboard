/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { deepStrictEqual, fail, ok } from "node:assert";
import test, { describe } from "node:test";
import simple from "../../bgl/simple.bgl.json" with { type: "json" };
import { LocalRunner } from "../../../src/harness/local-runner.js";
import { GraphDescriptor } from "@google-labs/breadboard-schema/graph.js";
import { testKit } from "../test-kit.js";
import { createLoader } from "../../../src/loader/index.js";
import { OutputResponse } from "../../../src/types.js";
import { HarnessRunner } from "../../../src/harness/types.js";

type EventLogEntry = [name: string, data: unknown];

const eventNamesFromLog = (log: EventLogEntry[]) => log.map(([name]) => name);
const queryLog = (log: EventLogEntry[], name: string) =>
  log.find(([n]) => n == name)?.[1];

const logEvents = (runner: HarnessRunner, events: EventLogEntry[]) => {
  const eventNames = [
    "start",
    "pause",
    "resume",
    "input",
    "output",
    "secret",
    "error",
    "skip",
    "graphstart",
    "graphend",
    "nodestart",
    "nodeend",
    "end",
  ];
  eventNames.forEach((name) => {
    runner.addEventListener(name, (event) => {
      const e = event as unknown as { data: unknown };
      events.push([name, e.data]);
    });
  });
};

describe("LocalRunner", async () => {
  test("simple graph with no diagnostics", async () => {
    const events: [name: string, data: unknown][] = [];
    const runner = new LocalRunner({
      runner: simple as GraphDescriptor,
      url: import.meta.url,
      loader: createLoader(),
      kits: [testKit],
    });
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
    const runner = new LocalRunner({
      runner: simple as GraphDescriptor,
      url: import.meta.url,
      loader: createLoader(),
      kits: [testKit],
      diagnostics: true,
    });
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
