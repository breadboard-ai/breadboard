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
} from "@google-labs/breadboard";

export enum EditorMode {
  MINIMAL = "minimal",
  ADVANCED = "advanced",
}

const removeHardPort = (...names: string[]) => {
  return (port: InspectablePort) => {
    if (port.edges.length > 0) {
      return true;
    }

    if (
      (port.status === PortStatus.Connected ||
        port.status === PortStatus.Dangling) &&
      !port.configured
    )
      return true;
    if (port.star) return false;
    if (port.schema.behavior?.includes("config")) return false;
    const items = port.schema.items;
    if (items && !Array.isArray(items) && items.behavior?.includes("config")) {
      return false;
    }
    if (names.includes(port.name)) return false;
    return true;
  };
};

const removeWiredPort = (port: InspectablePort) => {
  return port.schema.behavior?.includes("config");
};

const removeStarPort = (port: InspectablePort) => {
  return !port.star && port.name !== "";
};

export const filterConfigByMode = (
  ports: InspectableNodePorts,
  mode: EditorMode
) => {
  const inputs: InspectablePortList = {
    fixed: ports.inputs.fixed,
    ports: ports.inputs.ports.filter(
      mode === EditorMode.ADVANCED ? removeStarPort : removeWiredPort
    ),
  };

  return { inputs, outputs: ports.outputs };
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

  return { inputs, outputs };
};
