/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { TraversalState } from "../src/traversal/state.js";

test("TraversalState.replacer correctly serializes Maps", async (t) => {
  t.is(JSON.stringify({}, TraversalState.replacer), "{}");
  t.is(JSON.stringify("string", TraversalState.replacer), '"string"');
  t.is(JSON.stringify(42, TraversalState.replacer), "42");
  t.is(
    JSON.stringify(new Map([["foo", "bar"]]), TraversalState.replacer),
    '{"$type":"Map","value":[["foo","bar"]]}'
  );
  t.is(
    JSON.stringify(
      new Map([["foo", new Map([["bar", "baz"]])]]),
      TraversalState.replacer
    ),
    '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}'
  );
});

test("TraversalState.reviver correctly deserializes maps", async (t) => {
  t.deepEqual(JSON.parse("{}", TraversalState.reviver), {});
  t.deepEqual(JSON.parse('"string"', TraversalState.reviver), "string");
  t.deepEqual(JSON.parse("42", TraversalState.reviver), 42);
  t.deepEqual(
    JSON.parse(
      '{"$type":"Map","value":[["foo","bar"]]}',
      TraversalState.reviver
    ),
    new Map([["foo", "bar"]])
  );
  t.deepEqual(
    JSON.parse(
      '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}',
      TraversalState.reviver
    ),
    new Map([["foo", new Map([["bar", "baz"]])]])
  );
});

test("serializes fully into JSON", async (t) => {
  const state = new TraversalState();

  t.is(
    state.serialize(),
    '{"state":{"$type":"Map","value":[]},"constants":{"$type":"Map","value":[]}}'
  );

  state.update(
    "secrets-2",
    [
      {
        from: "secrets-2",
        to: "generateText-1",
        out: "PALM_KEY",
        in: "PALM_KEY",
      },
    ],
    {
      PALM_KEY: "key",
    }
  );

  t.is(
    state.serialize(),
    '{"state":{"$type":"Map","value":[["generateText-1",{"$type":"Map","value":[["secrets-2",{"PALM_KEY":"key"}]]}]]},"constants":{"$type":"Map","value":[]}}'
  );

  state.update(
    "secrets-2",
    [
      {
        from: "secrets-2",
        to: "generateText-1",
        out: "PALM_KEY",
        in: "PALM_KEY",
        constant: true,
      },
    ],
    {
      PALM_KEY: "key",
    }
  );

  t.is(
    state.serialize(),
    '{"state":{"$type":"Map","value":[["generateText-1",{"$type":"Map","value":[["secrets-2",{"PALM_KEY":"key"}]]}]]},"constants":{"$type":"Map","value":[["generateText-1",{"$type":"Map","value":[["secrets-2",{"PALM_KEY":"key"}]]}]]}}'
  );
});

test("deserializes nicely back from JSON", async (t) => {
  const state = new TraversalState();
  {
    const json =
      '{"state":{"$type":"Map","value":[]},"constants":{"$type":"Map","value":[]}}';
    const deserializedState = TraversalState.deserialize(json);
    t.deepEqual(deserializedState, state);
  }

  state.update(
    "secrets-2",
    [
      {
        from: "secrets-2",
        to: "generateText-1",
        out: "PALM_KEY",
        in: "PALM_KEY",
      },
    ],
    {
      PALM_KEY: "key",
    }
  );

  {
    const json =
      '{"state":{"$type":"Map","value":[["generateText-1",{"$type":"Map","value":[["secrets-2",{"PALM_KEY":"key"}]]}]]},"constants":{"$type":"Map","value":[]}}';
    const deserializedState = TraversalState.deserialize(json);
    t.deepEqual(deserializedState, state);
  }

  state.update(
    "secrets-2",
    [
      {
        from: "secrets-2",
        to: "generateText-1",
        out: "PALM_KEY",
        in: "PALM_KEY",
        constant: true,
      },
    ],
    {
      PALM_KEY: "key",
    }
  );

  {
    const json =
      '{"state":{"$type":"Map","value":[["generateText-1",{"$type":"Map","value":[["secrets-2",{"PALM_KEY":"key"}]]}]]},"constants":{"$type":"Map","value":[["generateText-1",{"$type":"Map","value":[["secrets-2",{"PALM_KEY":"key"}]]}]]}}';
    const deserializedState = TraversalState.deserialize(json);
    t.deepEqual(deserializedState, state);
  }
});
