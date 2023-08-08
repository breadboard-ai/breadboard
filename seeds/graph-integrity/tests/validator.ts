/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { readFile, readdir } from "fs/promises";

import { GraphDescriptor, NodeDescriptor } from "@google-labs/graph-runner";
import { GraphIntegrityValidator } from "../src/validator.js";
import { SafetyLabel } from "../src/label.js";
import { SafetyLabelValue } from "../src/types.js";

const IN_DIR = "./tests/data/";

// JSON test data pattern copied and modified from
// graph-runner/tests/machines.ts

interface TestGraphDescriptor extends GraphDescriptor {
  safe: boolean;
  expectedLabels?: Array<[NodeDescriptor["id"], string]>;
}

const graphs = (await readdir(`${IN_DIR}/`)).filter((file) =>
  file.endsWith(".json")
);

const mapNameToSafetyLabel: { [key: string]: SafetyLabel } = {
  TRUSTED: new SafetyLabel(SafetyLabelValue.TRUSTED),
  UNTRUSTED: new SafetyLabel(SafetyLabelValue.UNTRUSTED),
  UNDEFINED: new SafetyLabel(undefined),
};

await Promise.all(
  graphs.map(async (filename) => {
    test(filename, async (t) => {
      const data = await readFile(`${IN_DIR}${filename}`, "utf-8");
      const graph = JSON.parse(data) as TestGraphDescriptor;

      const validator = new GraphIntegrityValidator();

      if (graph.safe) {
        validator.addGraph(graph);
        for (const [nodeId, expectedLabelName] of graph.expectedLabels ?? []) {
          const expectedLabel = mapNameToSafetyLabel[expectedLabelName];
          const derivedLabel = validator.getValidatorMetadata({
            id: nodeId,
            type: "undefined",
          }).label;
          t.true(derivedLabel.equalsTo(expectedLabel));
        }
      } else {
        t.throws(() => validator.addGraph(graph));
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
    description: "UNDETERMINED",
    label: new SafetyLabel(undefined),
  });
  t.throws(() => v.getValidatorMetadata({ id: "b", type: "input" }));
});

test("GraphSafetyValidator: Getting labels for nodes in subgraphs", (t) => {
  const v = new GraphIntegrityValidator();

  v.addGraph({
    edges: [
      { from: "in", to: "include", in: "x", out: "x" },
      { from: "include", to: "out", in: "y", out: "y" },
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
      { from: "in", to: "compute", in: "x", out: "compute" },
      { from: "compute", to: "out", in: "result", out: "y" },
    ],
    nodes: [
      { id: "in", type: "input" },
      { id: "compute", type: "runJavascript" },
      { id: "out", type: "output" },
    ],
  });

  t.deepEqual(v.getValidatorMetadata({ id: "in", type: "input" }), {
    description: "TRUSTED",
    label: new SafetyLabel(SafetyLabelValue.TRUSTED),
  });
  t.deepEqual(v.getValidatorMetadata({ id: "out", type: "output" }), {
    description: "TRUSTED",
    label: new SafetyLabel(SafetyLabelValue.TRUSTED),
  });
});
