/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  InspectableNodePorts,
  InspectablePort,
  InspectablePortList,
} from "@breadboard-ai/types";
import { PortStatus } from "@breadboard-ai/types";
import {
  EditorMode,
  filterConfigByMode,
  filterPortsByMode,
} from "../../src/utils/schema/mode.js";

function makePort(overrides: Partial<InspectablePort> = {}): InspectablePort {
  return {
    name: "port",
    star: false,
    status: PortStatus.Ready,
    configured: false,
    value: undefined,
    schema: {},
    edges: [],
    type: { hasBehavior: () => false, ports: [] },
    ...overrides,
  } as InspectablePort;
}

function makePorts(
  inputPorts: InspectablePort[],
  outputPorts: InspectablePort[] = []
): InspectableNodePorts {
  return {
    inputs: { fixed: true, ports: inputPorts } as InspectablePortList,
    outputs: { fixed: true, ports: outputPorts } as InspectablePortList,
    side: { fixed: true, ports: [] } as InspectablePortList,
    updating: false,
  };
}

describe("mode", () => {
  describe("filterPortsByMode", () => {
    it("returns all ports in ADVANCED mode", () => {
      const ports = makePorts([
        makePort({ name: "", star: true }),
        makePort({ name: "input" }),
      ]);
      const result = filterPortsByMode(ports, EditorMode.ADVANCED);
      assert.equal(result.inputs.ports.length, 2);
    });

    it("removes star ports in MINIMAL mode", () => {
      const ports = makePorts([
        makePort({ name: "star-port", star: true }),
        makePort({ name: "normal" }),
      ]);
      const result = filterPortsByMode(ports, EditorMode.MINIMAL);
      assert.equal(result.inputs.ports.length, 1);
      assert.equal(result.inputs.ports[0].name, "normal");
    });

    it("removes empty-name ports in MINIMAL mode", () => {
      const ports = makePorts([
        makePort({ name: "" }),
        makePort({ name: "real" }),
      ]);
      const result = filterPortsByMode(ports, EditorMode.MINIMAL);
      assert.equal(result.inputs.ports.length, 1);
      assert.equal(result.inputs.ports[0].name, "real");
    });

    it("keeps connected star ports in MINIMAL mode", () => {
      const ports = makePorts([
        makePort({
          name: "star-but-connected",
          star: true,
          status: PortStatus.Connected,
        }),
      ]);
      const result = filterPortsByMode(ports, EditorMode.MINIMAL);
      assert.equal(result.inputs.ports.length, 1);
    });

    it("removes $error from outputs in MINIMAL mode", () => {
      const ports = makePorts(
        [],
        [makePort({ name: "$error" }), makePort({ name: "output" })]
      );
      const result = filterPortsByMode(ports, EditorMode.MINIMAL);
      assert.equal(result.outputs.ports.length, 1);
      assert.equal(result.outputs.ports[0].name, "output");
    });
  });

  describe("filterConfigByMode", () => {
    it("filters star ports in ADVANCED mode", () => {
      const ports = makePorts([
        makePort({ name: "", star: true }),
        makePort({ name: "input" }),
      ]);
      const result = filterConfigByMode(ports, EditorMode.ADVANCED);
      assert.equal(result.inputs.ports.length, 1);
      assert.equal(result.inputs.ports[0].name, "input");
    });

    it("filters for config-behavior ports in MINIMAL mode", () => {
      const configPort = makePort({
        name: "setting",
        schema: { behavior: ["config"] },
      });
      const nonConfigPort = makePort({
        name: "other",
        schema: { behavior: ["llm-content"] },
      });
      const ports = makePorts([configPort, nonConfigPort]);
      const result = filterConfigByMode(ports, EditorMode.MINIMAL);
      assert.equal(result.inputs.ports.length, 1);
      assert.equal(result.inputs.ports[0].name, "setting");
    });

    it("falls back to non-dangling non-star when no config ports", () => {
      const regularPort = makePort({ name: "input", schema: {} });
      const danglingPort = makePort({
        name: "dangling",
        status: PortStatus.Dangling,
        schema: {},
      });
      const ports = makePorts([regularPort, danglingPort]);
      const result = filterConfigByMode(ports, EditorMode.MINIMAL);
      assert.equal(result.inputs.ports.length, 1);
      assert.equal(result.inputs.ports[0].name, "input");
    });
  });
});
