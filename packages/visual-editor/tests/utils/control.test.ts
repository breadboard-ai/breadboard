/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  computeControlState,
  computeSkipOutputs,
  augmentWithSkipOutputs,
  hasControlPart,
  routesFromConfiguration,
  toolsFromConfiguration,
} from "../../src/utils/control.js";
import type {
  InputValues,
  LLMContent,
  NodeConfiguration,
} from "@breadboard-ai/types";

afterEach(() => mock.restoreAll());

const CONTROL_SENTINEL_VALUE = "$control";
const ROUTE_TOOL_PATH = "control-flow/routing";

function tp(
  type: string,
  path: string,
  title = path,
  instance?: string
): string {
  const obj: Record<string, string> = { type, path, title };
  if (instance) obj.instance = instance;
  return `{${JSON.stringify(obj)}}`;
}

describe("control — hasControlPart", () => {
  it("returns true when a part contains a control sentinel", () => {
    const content: LLMContent = {
      parts: [{ json: { [CONTROL_SENTINEL_VALUE]: "route" } }],
      role: "user",
    };
    assert.equal(hasControlPart(content), true);
  });

  it("returns false when no part is a control sentinel", () => {
    const content: LLMContent = {
      parts: [{ text: "hello" }],
      role: "user",
    };
    assert.equal(hasControlPart(content), false);
  });

  it("returns false for json parts that are not control sentinels", () => {
    const content: LLMContent = {
      parts: [{ json: { someOtherKey: "value" } }],
      role: "user",
    };
    assert.equal(hasControlPart(content), false);
  });
});

describe("control — computeControlState", () => {
  it("returns skip=false for empty inputs", () => {
    const result = computeControlState({});
    assert.equal(result.skip, false);
  });

  it("returns skip=true and replaces control values with empty input", () => {
    const inputs: InputValues = {
      myInput: { [CONTROL_SENTINEL_VALUE]: "route" },
    };
    const result = computeControlState(inputs);
    assert.equal(result.skip, true);
    assert.ok(Array.isArray(result.adjustedInputs.myInput));
  });

  it("returns skip=false when at least one input is not a control value", () => {
    const inputs: InputValues = {
      controlInput: { [CONTROL_SENTINEL_VALUE]: "route" },
      normalInput: "hello",
    };
    const result = computeControlState(inputs);
    assert.equal(result.skip, false);
    assert.equal(result.adjustedInputs.normalInput, "hello");
  });
});

describe("control — computeSkipOutputs", () => {
  it("returns context as CONTROL_OUTPUT when no routes configured", () => {
    const result = computeSkipOutputs({});
    assert.ok("context" in result);
    assert.deepEqual(result.context, { [CONTROL_SENTINEL_VALUE]: "route" });
  });

  it("returns route-keyed outputs when routes are configured", () => {
    const config: NodeConfiguration = {
      prompt: {
        role: "user",
        parts: [
          { text: `Use ${tp("tool", ROUTE_TOOL_PATH, "Route", "route-a")}` },
        ],
      },
    };
    const result = computeSkipOutputs(config);
    assert.ok("route-a" in result);
    assert.deepEqual(result["route-a"], {
      [CONTROL_SENTINEL_VALUE]: "route",
    });
  });
});

describe("control — augmentWithSkipOutputs", () => {
  it("returns outputs unchanged when no routes configured", () => {
    const outputs = { context: "hello" };
    const result = augmentWithSkipOutputs({}, outputs);
    assert.deepEqual(result, outputs);
  });

  it("merges actual outputs over skip-control defaults for routes", () => {
    const config: NodeConfiguration = {
      prompt: {
        role: "user",
        parts: [
          {
            text: `Route ${tp("tool", ROUTE_TOOL_PATH, "Route", "route-a")} and ${tp("tool", ROUTE_TOOL_PATH, "Route", "route-b")}`,
          },
        ],
      },
    };
    const outputs = { "route-a": "actual-value" };
    const result = augmentWithSkipOutputs(config, outputs);
    // route-a should have the actual value, route-b should have control output
    assert.equal(result["route-a"], "actual-value");
    assert.deepEqual(result["route-b"], {
      [CONTROL_SENTINEL_VALUE]: "route",
    });
  });
});

describe("control — routesFromConfiguration", () => {
  it("returns empty array for config with no tools", () => {
    assert.deepEqual(routesFromConfiguration({}), []);
  });

  it("filters for route tool path tools with instances", () => {
    const config: NodeConfiguration = {
      prompt: {
        role: "user",
        parts: [
          {
            text: `${tp("tool", ROUTE_TOOL_PATH, "R1", "instance-1")} ${tp("tool", "some-other-tool", "Other")}`,
          },
        ],
      },
    };
    const routes = routesFromConfiguration(config);
    assert.deepEqual(routes, ["instance-1"]);
  });
});

describe("control — toolsFromConfiguration", () => {
  it("extracts tool template parts from configuration", () => {
    const config: NodeConfiguration = {
      prompt: {
        role: "user",
        parts: [
          {
            text: `Use ${tp("tool", "my-tool-path", "MyTool")} here`,
          },
        ],
      },
    };
    const tools = toolsFromConfiguration(config);
    assert.equal(tools.length, 1);
    assert.equal(tools[0].path, "my-tool-path");
    assert.equal(tools[0].type, "tool");
  });

  it("returns empty for config without tool parts", () => {
    const tools = toolsFromConfiguration({
      prompt: {
        role: "user",
        parts: [{ text: `Hello ${tp("in", "name", "Name")}` }],
      },
    });
    assert.equal(tools.length, 0);
  });
});
