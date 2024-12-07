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
import { replaceSecrets } from "../../src/inspector/run/serializer.js";
import {
  createDefaultDataStore,
  createDefaultRunStore,
} from "../../src/data/index.js";
import { makeTestGraphStore } from "../helpers/_graph-store.js";

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
  for (const result of raw) {
    await observer.observe(result);
  }

  const runs = await observer.runs();
  return runs[0];
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
const NODE_PROPS = ["inputs", "outputs"];
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
      propsEqual(t, event1, event2, NODE_PROPS);
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
const GEMINI_SENTINEL = "103e9083-13fd-46b4-a9ee-683a09e31a26";

test("run save/load: loadRawRun works as expected", async (t) => {
  const store = makeTestGraphStore();
  const observer = createRunObserver(store, {
    logLevel: "debug",
  });
  const run1 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  const run2 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  runsEqual(t, run1, run2);
});

test("run save/load: observer.save -> run.load roundtrip", async (t) => {
  const store = makeTestGraphStore();
  const observer = createRunObserver(store, {
    logLevel: "debug",
    dataStore: createDefaultDataStore(),
    runStore: createDefaultRunStore(),
  });
  const run1 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  if (!run1.serialize) {
    t.fail("run1 should be serializable.");
    return;
  }
  const run1serialized = await run1.serialize({ keepSecrets: true });
  const run1LoadResult = await observer.load(run1serialized);
  if (!run1LoadResult.success) {
    t.fail(run1LoadResult.error);
    return;
  }
  runsEqual(t, run1, (await observer.runs())[0]);
});

test("run save/load: replaceSecrets correctly replaces secrets", async (t) => {
  const store = makeTestGraphStore();
  const observer = createRunObserver(store, {
    logLevel: "debug",
  });
  const run1 = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  if (!run1.serialize) {
    t.fail("run1 should be serializable.");
    return;
  }

  {
    const run1withoutSecrets = await run1.serialize();
    const sentinel = run1withoutSecrets.secrets?.["GEMINI_KEY"];
    t.not(sentinel, GEMINI_KEY_VALUE);
    const s = JSON.stringify(run1withoutSecrets);
    t.false(s.includes(GEMINI_KEY_VALUE));
    const sentinelCount = (s.match(new RegExp(sentinel!, "g")) || []).length;
    t.is(sentinelCount, 21);
  }

  {
    const run1withSecrets = await run1.serialize({ keepSecrets: true });

    // replace secrets with sentinel values.
    const elidedSecrets = replaceSecrets(run1withSecrets, (secret, value) => {
      t.is(secret, "GEMINI_KEY");
      t.is(value, GEMINI_KEY_VALUE);
      return GEMINI_SENTINEL;
    });
    const sentinel = elidedSecrets.secrets?.["GEMINI_KEY"];
    t.is(sentinel, GEMINI_SENTINEL);
    const s = JSON.stringify(elidedSecrets);
    t.false(s.includes(GEMINI_KEY_VALUE));
    const sentinelCount = (s.match(new RegExp(sentinel!, "g")) || []).length;
    t.is(sentinelCount, 21);

    // now, let's replace it back.
    const withSecrets = replaceSecrets(elidedSecrets, (secret) => {
      t.is(secret, "GEMINI_KEY");
      return GEMINI_KEY_VALUE;
    });
    const s2 = JSON.stringify(withSecrets);
    t.false(s2.includes(GEMINI_SENTINEL));
    const secretCount = (s2.match(new RegExp(GEMINI_KEY_VALUE, "g")) || [])
      .length;
    t.is(secretCount, 21);
  }
});

test("run load/save: serialization produces consistent size", async (t) => {
  const store = makeTestGraphStore();
  const observer = createRunObserver(store, {
    logLevel: "debug",
    dataStore: createDefaultDataStore(),
    runStore: createDefaultRunStore(),
    skipDataStore: true,
  });
  const run = await loadRawRun(observer, "ad-writer-2.1.raw.json");
  if (!run.serialize) {
    t.fail("run1 should be serializable.");
    return;
  }
  const serializedRun = await run.serialize();
  const s = JSON.stringify(serializedRun);
  t.is(s.length, 1175273);
  t.true(
    (
      await observer.load(serializedRun, {
        secretReplacer: () => GEMINI_KEY_VALUE,
      })
    ).success
  );
  runsEqual(t, run, (await observer.runs())[0]);
});
