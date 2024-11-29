/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier, NodeIdentifier } from "@breadboard-ai/types";
import {
  InspectableNodePortsSnapshot,
  InspectablePortListSnapshot,
  InspectablePortSnapshot,
  NodePortChanges,
} from "./types.js";
import {
  InspectableNodePorts,
  InspectablePort,
  InspectablePortList,
} from "../types.js";

export { PortUpdateReconciler };

type NodePortMap = Map<NodeIdentifier, InspectableNodePortsSnapshot>;

type PortsUpdate = {
  updated: InspectableNodePortsSnapshot;
  changes: NodePortChanges;
};

class PortUpdateReconciler {
  #map: Map<GraphIdentifier, NodePortMap> = new Map();

  reconcilePorts(
    incoming: InspectableNodePorts,
    existing?: InspectableNodePortsSnapshot
  ): PortsUpdate {
    if (!existing) {
      return this.createNewSnapshot(incoming);
    }
    throw new Error("Not implemented");
  }

  createNewSnapshot(incoming: InspectableNodePorts): PortsUpdate {
    return {
      updated: toPortsSnapshot(incoming),
      changes: {
        input: toUpdates(incoming.inputs),
        output: toUpdates(incoming.outputs),
        side: toUpdates(incoming.side),
      },
    };

    function toPortsSnapshot(
      ports: InspectableNodePorts
    ): InspectableNodePortsSnapshot {
      return {
        inputs: toPortListSnapshot(ports.inputs),
        outputs: toPortListSnapshot(ports.outputs),
        side: toPortListSnapshot(ports.side),
      };
    }

    function toPortListSnapshot(
      list: InspectablePortList
    ): InspectablePortListSnapshot {
      return {
        fixed: list.fixed,
        ports: list.ports.map((port) => toPortSnapshot(port)),
      };
    }

    function toPortSnapshot(port: InspectablePort): InspectablePortSnapshot {
      return {
        name: port.name,
        title: port.title,
        status: port.status,
        configured: port.configured,
        value: port.value,
        star: port.star,
        schema: port.schema,
        kind: port.kind,
      };
    }

    function toUpdates(ports: InspectablePortList) {
      return {
        fixedChanged: ports.fixed,
        deleted: [],
        added: ports.ports.map((port) => {
          return toPortSnapshot(port);
        }),
        updated: [],
      };
    }
  }

  getChanges(
    graphId: GraphIdentifier,
    nodeId: NodeIdentifier,
    ports: InspectableNodePorts
  ): NodePortChanges {
    let graphPorts = this.#map.get(graphId);
    if (!graphPorts) {
      graphPorts = new Map();
      this.#map.set(graphId, graphPorts);
    }
    const nodePorts = graphPorts.get(nodeId);
    const { updated, changes } = this.reconcilePorts(ports, nodePorts);
    graphPorts.set(nodeId, updated);
    return changes;
  }
}
