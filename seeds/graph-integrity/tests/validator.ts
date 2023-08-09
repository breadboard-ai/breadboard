/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { readFile, readdir } from "fs/promises";

import { GraphDescriptor, NodeDescriptor } from "@google-labs/graph-runner";
import { GraphIntegrityValidator } from "../src/validator.js";
import { Label, LabelValue } from "../src/label.js";

const IN_DIR = "./tests/data/";

// JSON test data pattern copied and modified from
// graph-runner/tests/machines.ts

interface TestGraphDescriptor extends GraphDescriptor {
  safe: boolean;
  expectedLabels?: Array<[NodeDescriptor["id"], string, string]>;
}

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

const mapNameToLabel: { [key: string]: LabelValue | undefined } = {
  TRUSTED: LabelValue.TRUSTED,
  UNTRUSTED: LabelValue.UNTRUSTED,
  UNDETERMINED: undefined,
};

const trustedIntegrity = new Label({
  integrity: LabelValue.TRUSTED,
});

const untrustedIntegrity = new Label({
  integrity: LabelValue.UNTRUSTED,
});

await Promise.all(
  graphs.map(async (filename) => {
    test(filename, async (t) => {
      const data = await readFile(`${IN_DIR}${filename}`, "utf-8");
      const graph = JSON.parse(data) as TestGraphDescriptor;

      const validator = new GraphIntegrityValidator();

      if (graph.safe) {
        t.notThrows(() => validator.addGraph(graph));
        for (const [
          nodeId,
          confidentiality,
          integrity,
        ] of graph.expectedLabels ?? []) {
          const expectedLabel = new Label({
            confidentiality: mapNameToLabel[confidentiality],
            integrity: mapNameToLabel[integrity],
          });
          const derivedLabel = validator.getValidatorMetadata({
            id: nodeId,
            type: "undefined",
          }).label;
          t.true(
            derivedLabel.equalsTo(expectedLabel),
            `${nodeId}: ${derivedLabel.toString()} vs ${expectedLabel.toString()}`
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
      { from: "in2", to: "compute", out: "x", in: "compute" },
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

  v.addGraph({
    edges: [
      { from: "in", to: "include", out: "*" },
      { from: "include", to: "out", out: "*" },
      { from: "include", to: "outz", out: "z" },
    ],
    nodes: [
      { id: "in", type: "input" },
      { id: "include", type: "include" },
      { id: "out", type: "output" },
      { id: "outz", type: "output" },
    ],
  });

  const v2 = v.getSubgraphValidator({ id: "include", type: "include" });
  v2.addGraph({
    edges: [
      { from: "in1", to: "fetch", out: "x", in: "url" },
      { from: "fetch", to: "out1", out: "response", in: "y" },
      { from: "in2", to: "compute", out: "x", in: "compute" },
      { from: "compute", to: "out2", out: "result", in: "z" },
    ],
    nodes: [
      { id: "in1", type: "input" },
      { id: "in2", type: "input" },
      { id: "compute", type: "runJavascript" },
      { id: "fetch", type: "fetch" },
      { id: "out1", type: "output" },
      { id: "out2", type: "output" },
    ],
  });

  t.deepEqual(v.getValidatorMetadata({ id: "in", type: "input" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });

  // We expect the * wire to be UNTRUSTED, because it is not connected to both
  // fetch and compute.
  t.deepEqual(v.getValidatorMetadata({ id: "out", type: "output" }), {
    description: "[UNDETERMINED, UNTRUSTED]",
    label: untrustedIntegrity,
  });

  // But this doesn't clobber the single z wire out!
  t.deepEqual(v.getValidatorMetadata({ id: "outz", type: "output" }), {
    description: "[UNDETERMINED, TRUSTED]",
    label: trustedIntegrity,
  });
});
