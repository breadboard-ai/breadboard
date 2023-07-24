/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import test from "ava";

import { readFile, readdir } from "fs/promises";

import { GraphDescriptor, NodeDescriptor } from "@google-labs/graph-runner";
import { GraphSafetyValidator } from "../src/validator.js";
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

      const validator = new GraphSafetyValidator(graph);

      if (graph.safe) {
        validator.computeLabelsForFullGraph();
        for (const [nodeId, expectedLabelName] of graph.expectedLabels || []) {
          const expectedLabel = mapNameToSafetyLabel[expectedLabelName];
          const derivedLabel = validator.getSafetyLabel(nodeId);
          t.true(derivedLabel.equalsTo(expectedLabel));
        }
      } else {
        t.throws(() => validator.computeLabelsForFullGraph());
      }
    });
  })
);

test("GraphSafetyValidator: no labels before computation", (t) => {
  const v = new GraphSafetyValidator({
    edges: [],
    nodes: [{ id: "a", type: "input" }],
  });

  t.throws(() => v.getSafetyLabel("a"));
});
