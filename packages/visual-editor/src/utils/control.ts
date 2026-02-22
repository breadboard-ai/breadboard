import {
  InputValues,
  LLMContent,
  NodeConfiguration,
  NodeValue,
  OutputValues,
} from "@breadboard-ai/types";
import { TemplatePart } from "@breadboard-ai/utils";
import { scanConfiguration } from "./scan-configuration.js";
import { ROUTE_TOOL_PATH } from "../a2/a2/tool-manager.js";

export {
  computeControlState,
  computeSkipOutputs,
  augmentWithSkipOutputs,
  hasControlPart,
  routesFromConfiguration,
  toolsFromConfiguration,
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

function toolsFromConfiguration(configuration: NodeConfiguration) {
  const tools: TemplatePart[] = [];
  scanConfiguration(configuration, (part) => {
    if (part.type === "tool") {
      tools.push(part);
    }
  });
  return tools;
}

function routesFromConfiguration(configuration: NodeConfiguration) {
  return toolsFromConfiguration(configuration)
    .filter((part) => part.path === ROUTE_TOOL_PATH && part.instance)
    .map((part) => part.instance!);
}
