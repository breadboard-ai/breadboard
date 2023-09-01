/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";
import { MachineEdgeState } from "../src/traversal/state.js";

test("EdgeState.replacer correctly serializes Maps", async (t) => {
  t.is(JSON.stringify({}, MachineEdgeState.replacer), "{}");
  t.is(JSON.stringify("string", MachineEdgeState.replacer), '"string"');
  t.is(JSON.stringify(42, MachineEdgeState.replacer), "42");
  t.is(
    JSON.stringify(new Map([["foo", "bar"]]), MachineEdgeState.replacer),
    '{"$type":"Map","value":[["foo","bar"]]}'
  );
  t.is(
    JSON.stringify(
      new Map([["foo", new Map([["bar", "baz"]])]]),
      MachineEdgeState.replacer
    ),
    '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}'
  );
});

test("EdgeState.reviver correctly deserializes maps", async (t) => {
  t.deepEqual(JSON.parse("{}", MachineEdgeState.reviver), {});
  t.deepEqual(JSON.parse('"string"', MachineEdgeState.reviver), "string");
  t.deepEqual(JSON.parse("42", MachineEdgeState.reviver), 42);
  t.deepEqual(
    JSON.parse(
      '{"$type":"Map","value":[["foo","bar"]]}',
      MachineEdgeState.reviver
    ),
    new Map([["foo", "bar"]])
  );
  t.deepEqual(
    JSON.parse(
      '{"$type":"Map","value":[["foo",{"$type":"Map","value":[["bar","baz"]]}]]}',
      MachineEdgeState.reviver
    ),
    new Map([["foo", new Map([["bar", "baz"]])]])
  );
});

test("serializes fully into JSON", async (t) => {
  const state = new MachineEdgeState();

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
  const state = new MachineEdgeState();
  {
    const json =
      '{"state":{"$type":"Map","value":[]},"constants":{"$type":"Map","value":[]}}';
    const deserializedState = MachineEdgeState.deserialize(json);
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
    const deserializedState = MachineEdgeState.deserialize(json);
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
    const deserializedState = MachineEdgeState.deserialize(json);
    t.deepEqual(deserializedState, state);
  }
});
