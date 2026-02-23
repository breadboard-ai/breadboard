/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InspectableNodePorts,
  InspectablePort,
  InspectablePortList,
  PortStatus,
} from "@breadboard-ai/types";

export enum EditorMode {
  MINIMAL = "minimal",
  ADVANCED = "advanced",
}

const removeHardPort = (...names: string[]) => {
  return (port: InspectablePort) => {
    if (port.status === PortStatus.Connected) return true;
    if (port.star) return false;
    if (port.name === "") return false;
    if (names.includes(port.name)) return false;

    return true;
  };
};

export const filterConfigByMode = (
  ports: InspectableNodePorts,
  mode: EditorMode
): InspectableNodePorts => {
  const outputs = ports.outputs;

  if (mode === EditorMode.ADVANCED) {
    return {
      inputs: {
        fixed: ports.inputs.fixed,
        ports: ports.inputs.ports.filter(removeStarPort),
      },
      outputs,
      side: ports.side,
      updating: ports.updating,
    };
  }

  let containedConfig;
  let inputPorts = ports.inputs.ports.filter(filterForConfigAware);

  if (!containedConfig) {
    inputPorts = ports.inputs.ports.filter(filterForConfigUnaware);
  }

  const inputs: InspectablePortList = {
    fixed: ports.inputs.fixed,
    ports: inputPorts,
  };

  return {
    inputs,
    outputs: ports.outputs,
    side: ports.side,
    updating: ports.updating,
  };

  function filterForConfigAware(port: InspectablePort) {
    const hasConfig = port.schema.behavior?.includes("config");
    if (hasConfig && !port.name.startsWith("$")) {
      containedConfig = true;
    }
    return hasConfig;
  }

  function filterForConfigUnaware(port: InspectablePort) {
    return removeStarPort(port) && port.status !== PortStatus.Dangling;
  }

  function removeStarPort(port: InspectablePort) {
    return !port.star && port.name !== "";
  }
};

export const filterPortsByMode = (
  ports: InspectableNodePorts,
  mode: EditorMode
): InspectableNodePorts => {
  if (mode === EditorMode.ADVANCED) return ports;

  const inputs: InspectablePortList = {
    fixed: ports.inputs.fixed,
    ports: ports.inputs.ports.filter(removeHardPort()),
  };

  const outputs: InspectablePortList = {
    fixed: ports.outputs.fixed,
    ports: ports.outputs.ports.filter(removeHardPort("$error")),
  };

  return { inputs, outputs, side: ports.side, updating: ports.updating };
};
