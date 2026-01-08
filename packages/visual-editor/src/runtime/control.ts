/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputValues,
  LLMContent,
  NodeConfiguration,
  NodeValue,
  OutputValues,
} from "@breadboard-ai/types";
import { routesFromConfiguration } from "../engine/inspector/graph/graph-queries.js";

export {
  computeControlState,
  computeSkipOutputs,
  augmentWithSkipOutputs,
  hasControlPart,
};

const CONTROL_SENTINEL_VALUE = "$control";
const EMPTY_INPUT: NodeValue = [
  { parts: [{ text: "" }] },
] satisfies LLMContent[];
const CONTROL_OUTPUT: Control = { [CONTROL_SENTINEL_VALUE]: "route" };

type Control = {
  [CONTROL_SENTINEL_VALUE]: string;
};

type ControlState = {
  skip: boolean;
  adjustedInputs: InputValues;
};

function isControl(o: unknown): o is Control {
  return !!(o && typeof o === "object" && CONTROL_SENTINEL_VALUE in o);
}

function hasControlPart(o: LLMContent) {
  return o.parts.some((part) => "json" in part && isControl(part.json));
}

function computeControlState(inputs: InputValues): ControlState {
  const entries = Object.entries(inputs);
  if (entries.length === 0) {
    return { skip: false, adjustedInputs: inputs };
  }
  const adjustedInputs: InputValues = {};
  let skip = true;
  for (const [name, value] of entries) {
    if (isControl(value)) {
      adjustedInputs[name] = EMPTY_INPUT;
    } else {
      adjustedInputs[name] = value;
      skip = false;
    }
  }
  return { skip, adjustedInputs };
}

function computeSkipOutputs(configuration: NodeConfiguration): OutputValues {
  const routes = routesFromConfiguration(configuration);
  if (routes.length === 0) {
    return { context: CONTROL_OUTPUT };
  }
  return Object.fromEntries(routes.map((route) => [route, CONTROL_OUTPUT]));
}

function augmentWithSkipOutputs(
  configuration: NodeConfiguration,
  outputs: OutputValues
): OutputValues {
  const routes = routesFromConfiguration(configuration);
  if (routes.length === 0) {
    return outputs;
  }
  const allSkipped = Object.fromEntries(
    routes.map((route) => [route, CONTROL_OUTPUT])
  );
  return { ...allSkipped, ...outputs };
}
