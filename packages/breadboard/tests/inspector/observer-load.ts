/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test, { ExecutionContext } from "ava";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  InspectableRun,
  InspectableRunEvent,
  InspectableRunObserver,
} from "../../src/inspector/types.js";
import { createRunObserver } from "../../src/index.js";
import { HarnessRunResult } from "../../src/harness/types.js";

const BASE_PATH = new URL(
  "../../../tests/inspector/data/loader",
  import.meta.url
).pathname;

const loadRawRun = async (
  observer: InspectableRunObserver,
  name: string
): Promise<InspectableRun> => {
  const s = await readFile(join(BASE_PATH, name), "utf-8");
  const raw = JSON.parse(s) as HarnessRunResult[];
  raw.forEach((result) => {
    observer.observe(result);
  });
  return observer.runs()[0];
};

const propsEqual = (
  t: ExecutionContext,
  o1: Record<string, unknown>,
  o2: Record<string, unknown>,
  props: string[]
) => {
  props.forEach((prop) => {
    t.deepEqual(o1[prop], o2[prop], prop);
  });
};

const EVENT_PROPS = ["type", "start", "end", "bubbled", "hidden"];
const RUN_PROPS = ["graphId", "graphVersion", "start", "end"];

const eventsEqual = (
  t: ExecutionContext,
  events1: InspectableRunEvent[],
  events2: InspectableRunEvent[]
) => {
  t.is(events1.length, events2.length);
  events1.forEach((event1, index) => {
    const event2 = events2[index];
    t.truthy(event2);
    propsEqual(t, event1, event2, EVENT_PROPS);
    if (event1.type === "node" && event2.type === "node") {
      event1.runs.forEach((run1, index) => {
        const run2 = event2.runs[index];
        runsEqual(t, run1, run2);
      });
    }
  });
};

const runsEqual = (
  t: ExecutionContext,
  run1: InspectableRun,
  run2: InspectableRun
) => {
  propsEqual(t, run1, run2, RUN_PROPS);
  eventsEqual(t, run1.events, run2.events);
};

const GEMINI_KEY_VALUE = "b576eea9-5ae6-4e9d-9958-e798ad8dbff7";

test("run save/load: loadRawRun works as expected", async (t) => {
  const observer = createRunObserver({ logLevel: "debug" });
  const run1 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  const run2 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  runsEqual(t, run1, run2);
});

test("run save/load: observer.save -> run.load roundtrip", async (t) => {
  const observer = createRunObserver({ logLevel: "debug" });
  const run1 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  if (!run1.serialize) {
    t.fail("run1 should be serializable.");
    return;
  }
  const run1serialized = run1.serialize();
  // console.log("SIZE:", JSON.stringify(run1serialized).length / 1000);
  const run1LoadResult = observer.load(run1serialized);
  if (!run1LoadResult.success) {
    t.fail(run1LoadResult.error);
    return;
  }
  runsEqual(t, run1, observer.runs()[0]);
});

test("run save/load: observer.save elides secrets", async (t) => {
  const observer = createRunObserver({ logLevel: "debug" });
  const run1 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  if (!run1.serialize) {
    t.fail("run1 should be serializable.");
    return;
  }
  const run1serialized = run1.serialize();
  const sentinel = run1serialized.secrets["GEMINI_KEY"];
  t.truthy(sentinel);
  const s = JSON.stringify(run1serialized);
  t.false(s.includes(GEMINI_KEY_VALUE));
  const sentinelCount = (s.match(new RegExp(sentinel, "g")) || []).length;
  t.is(sentinelCount, 21);
});
