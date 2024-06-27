/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { readFile, readdir } from "fs/promises";

import { GraphDescriptor, NodeDescriptor } from "@google-labs/breadboard";
import { GraphIntegrityValidator } from "../src/validator.js";
import { Label, PrincipalLattice } from "../src/label.js";
import { Policy } from "../src/policy.js";

const IN_DIR = "./tests/data/";

// JSON test data pattern copied and modified from
// breadboard/tests/machine.ts

interface TestGraphDescriptor extends GraphDescriptor {
  safe: boolean;
  expectedLabels?: Array<[NodeDescriptor["id"], string, string]>;
}

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

const lattice = new PrincipalLattice();

const trustedIntegrity = new Label({
  integrity: lattice.TRUSTED,
});

const untrustedIntegrity = new Label({
  integrity: lattice.UNTRUSTED,
});

const policy: Policy = {
  fetch: {
    outgoing: {
      response: untrustedIntegrity,
    },
  },
  runJavascript: {
    incoming: {
      code: trustedIntegrity,
      name: trustedIntegrity,
    },
  },
};

await Promise.all(
  graphs.map(async (filename) => {
    test(filename, async (t) => {
      const data = await readFile(`${IN_DIR}${filename}`, "utf-8");
      const graph = JSON.parse(data) as TestGraphDescriptor;

      const validator = new GraphIntegrityValidator();
      validator.addPolicy(policy);

      if (graph.safe) {
        t.notThrows(() => validator.addGraph(graph));
        for (const [
          nodeId,
          confidentiality,
          integrity,
        ] of graph.expectedLabels ?? []) {
          const derivedLabel = validator.getValidatorMetadata({
            id: nodeId,
            type: "undefined",
          }).label;
          const expectedLabel = new Label({
            confidentiality: lattice.get(confidentiality),
            integrity: lattice.get(integrity),
          });
          t.true(
            derivedLabel.equalsTo(expectedLabel),
            `${nodeId}: ${derivedLabel.toString()} vs ` +
              `[${confidentiality}, ${integrity}]`
          );
        }
      } else {
        try {
          validator.addGraph(graph);
          t.fail(`Graph should be unsafe, but got: ${validator.toMermaid()}`);
        } catch (e) {
          t.pass();
        }
      }
    });
  })
);

test("GraphSafetyValidator: Getting unknown labels throws", (t) => {
  const v = new GraphIntegrityValidator();

  t.throws(() => v.getValidatorMetadata({ id: "a", type: "input" }));

  v.addGraph({
    edges: [],
    nodes: [{ id: "a", type: "input" }],
  });

  t.deepEqual(v.getValidatorMetadata({ id: "a", type: "input" }), {
    description: "[UNDETERMINED, UNDETERMINED]",
    label: new Label(undefined),
  });
  t.throws(() => v.getValidatorMetadata({ id: "b", type: "input" }));
});

test("GraphSafetyValidator: Getting labels for nodes in subgraphs", (t) => {
  const v = new GraphIntegrityValidator();
  v.addPolicy(policy);

  v.addGraph({
    edges: [
      { from: "in", to: "include", out: "x", in: "x" },
      { from: "include", to: "out", out: "y", in: "y" },
      { from: "include", to: "out", out: "z", in: "z" },
    ],
    nodes: [
      { id: "in", type: "input" },
      { id: "include", type: "include" },
      { id: "out", type: "output" },
    ],
  });

  const v2 = v.getSubgraphValidator({ id: "include", type: "include" });
  v2.addGraph({
    edges: [
      { from: "in1", to: "fetch", out: "x", in: "url" },
      { from: "fetch", to: "out1", out: "response", in: "y" },
      { from: "in2", to: "compute", out: "x", in: "code" },
      { from: "compute", to: "out2", out: "result", in: "z" },
    ],
    nodes: [
      { id: "in1", type: "input" },
      { id: "in2", type: "input" },
      { id: "fetch", type: "fetch" },
      { id: "compute", type: "runJavascript" },
      { id: "out1", type: "output" },
      { id: "out2", type: "output" },
    ],
  });

  t.deepEqual(v.getValidatorMetadata({ id: "in", type: "input" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });
  t.deepEqual(v.getValidatorMetadata({ id: "out", type: "output" }), {
    description: "[UNDETERMINED, UNTRUSTED]",
    label: untrustedIntegrity,
  });
  t.deepEqual(v2.getValidatorMetadata({ id: "in1", type: "input" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });
  t.deepEqual(v2.getValidatorMetadata({ id: "in2", type: "input" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });
  t.deepEqual(v2.getValidatorMetadata({ id: "out1", type: "output" }), {
    description: "[UNDETERMINED, UNTRUSTED]",
    label: untrustedIntegrity,
  });
  t.deepEqual(v2.getValidatorMetadata({ id: "out2", type: "output" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });
});

test("GraphSafetyValidator: Subgraphs with * wires", (t) => {
  const v = new GraphIntegrityValidator();
  v.addPolicy(policy);

  const graph1 = {
    edges: [
      { from: "in", to: "include", out: "*" },
      { from: "include", to: "out", out: "*" },
      { from: "include", to: "out_result", out: "result" },
    ],
    nodes: [
      { id: "in", type: "input" },
      { id: "include", type: "include" },
      { id: "out", type: "output" },
      { id: "out_result", type: "output" },
    ],
  };

  const graph2 = {
    edges: [
      { from: "in1", to: "fetch", out: "url", in: "url" },
      { from: "fetch", to: "out1", out: "response", in: "response" },
      { from: "in2", to: "compute", out: "compute", in: "code" },
      { from: "compute", to: "out2", out: "result", in: "result" },
    ],
    nodes: [
      { id: "in1", type: "input" },
      { id: "in2", type: "input" },
      { id: "compute", type: "runJavascript" },
      { id: "fetch", type: "fetch" },
      { id: "out1", type: "output" },
      { id: "out2", type: "output" },
    ],
  };

  v.addGraph(graph1);

  // Add second graph, but only the compute input was provided. This means the
  // fetch parts should be ignored.
  const v2 = v.getSubgraphValidator({ id: "include", type: "include" }, [
    "compute",
  ]);
  v2.addGraph(graph2);

  // We expect input to be TRUSTED, because it feeds into a node that requires
  // trusted inputs.
  t.deepEqual(v.getValidatorMetadata({ id: "in", type: "input" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });

  // We expect the * wire to be TRUSTED, because we only connected to compute
  // leg of the graph.
  t.deepEqual(v.getValidatorMetadata({ id: "out", type: "output" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });

  // And so is of course the result wire.
  t.deepEqual(v.getValidatorMetadata({ id: "out_result", type: "output" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });

  // Add the second graph again, but now the fetch parts.
  const v3 = v.getSubgraphValidator({ id: "include", type: "url" }, ["url"]);
  v3.addGraph(graph2);

  // Now we expect the * wire to be UNTRUSTED, because it is now connected to
  // both fetch and compute.
  t.deepEqual(v.getValidatorMetadata({ id: "out", type: "output" }), {
    description: "[UNDETERMINED, UNTRUSTED]",
    label: untrustedIntegrity,
  });

  // But this doesn't clobber the single result wire out!
  t.deepEqual(v.getValidatorMetadata({ id: "out_result", type: "output" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });
});
