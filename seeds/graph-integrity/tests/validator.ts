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
