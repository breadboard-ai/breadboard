/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { KitBuilder } from "@google-labs/breadboard/kits";
import runPython from "./nodes/run-python.js";

const builder = new KitBuilder({
  title: "Python Kit",
  description: "A kit that contains nodes for running Python.",
  version: "0.0.1",
  url: "npm:@google-labs/run-python-kit",
});

export const RunPythonKit = builder.build({
  runPython,
});

export type RunPythonKit = InstanceType<typeof RunPythonKit>;

export default RunPythonKit;

/**
 * This is a wrapper around existing kits for the new syntax to add types.
 *
 * This should transition to a codegen step, with typescript types constructed
 * from .describe() calls.
 */
import {
  addKit,
  NewNodeValue as NodeValue,
  NewNodeFactory as NodeFactory,
} from "@google-labs/breadboard";

export type RunPythonKitType = {
  /**
   * Use this node to populate simple handlebar-style templates. A required
   * input is `template`, which is a string that contains the template prompt
   * template. The template can contain zero or more placeholders that will be
   * replaced with values from inputs. Specify placeholders as `{{inputName}}`
   * in the template. The placeholders in the template must match the inputs
   * wired into this node. The node will replace all placeholders with values
   * from the input property bag and pass the result along as the `prompt`
   * output property.
   */
  runPython: NodeFactory<
    {
      /**
       * The Python code to run.
       */
      code: string;
      /**
       * The values to provide to the code.
       */
      [key: string]: NodeValue;
    },
    {
      /**
       * The result of code being ran.
       */
      text: string;
    }
  >;
};

export const runpythons = addKit(RunPythonKit) as unknown as RunPythonKitType;
