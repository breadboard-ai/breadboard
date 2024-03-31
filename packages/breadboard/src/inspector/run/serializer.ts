/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeValue,
} from "@google-labs/breadboard-schema/graph.js";
import {
  GraphUUID,
  TimelineEntry,
  RunSerializationOptions,
  SerializedRun,
  SerializedRunSecretReplacer,
  PathRegistryEntry,
  InspectableRunNodeEvent,
} from "../types.js";
import {
  GraphEndProbeData,
  GraphStartProbeData,
  InputResponse,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
} from "../../types.js";
import { pathFromId } from "./path-registry.js";

export type SequenceEntry = [
  type: TimelineEntry["type"],
  entry: PathRegistryEntry,
];

export class RunSerializer {
  #timeline: TimelineEntry[] = [];
  #graphs: Map<GraphUUID, boolean> = new Map();

  #remember(entry: TimelineEntry) {
    this.#timeline.push(entry);
  }

  addGraphstart(
    data: GraphStartProbeData,
    graphId: GraphUUID,
    newGraph: boolean
  ) {
    const { timestamp, graph, path } = data;
    const type = "graphstart";
    if (newGraph) {
      this.#remember({ type, data: { timestamp, graph, path, graphId } });
    } else {
      this.#remember({ type, data: { timestamp, graph: null, path, graphId } });
    }
  }

  addGraphend(data: unknown) {
    this.#remember({ type: "graphend", data });
  }

  addNodestart(data: NodeStartResponse) {
    this.#remember({ type: "nodestart", data });
  }

  addNodeend(data: NodeEndResponse) {
    this.#remember({
      type: "nodeend",
      data: {
        timestamp: data.timestamp,
        outputs: data.outputs,
        path: data.path,
        node: { type: data.node.type },
      },
    });
  }

  addInput(data: unknown) {
    this.#remember({ type: "input", data });
  }

  addOutput(data: unknown) {
    this.#remember({ type: "output", data });
  }

  addSecret(data: unknown) {
    this.#remember({ type: "secret", data });
  }

  addError(data: unknown) {
    this.#remember({ type: "error", data });
  }

  serializeGraphstart(
    entry: PathRegistryEntry,
    seenGraphs: Set<GraphUUID>
  ): TimelineEntry {
    const { graphId } = entry;
    if (graphId === null) {
      throw new Error("Encountered an empty graphId during graphstart.");
    }
    let graph: GraphDescriptor | null = null;
    if (!seenGraphs.has(graphId)) {
      graph = entry.graph?.raw() || null;
      seenGraphs.add(graphId);
    }
    return {
      type: "graphstart",
      data: {
        timestamp: entry.graphStart,
        path: pathFromId(entry.id),
        graphId,
        graph,
      },
    };
  }

  serializeGraphend(entry: PathRegistryEntry): TimelineEntry {
    return {
      type: "graphend",
      data: {
        path: pathFromId(entry.id),
        timestamp: entry.graphEnd as number,
      } satisfies GraphEndProbeData,
    };
  }

  serializeNodestart(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    return {
      type: "nodestart",
      data: {
        node: event.node.descriptor,
        inputs: event.inputs,
        path: pathFromId(entry.id),
        timestamp: event.start,
      } satisfies NodeStartResponse,
    };
  }

  serializeInput(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    if (!event) {
      throw new Error("Unexpected empty input event while serializing run");
    }
    return {
      type: "input",
      data: {
        path: pathFromId(entry.id),
        timestamp: event.start, // TODO: make sure these match in the runner.
        node: event.node.descriptor,
        inputArguments: event.inputs,
        bubbled: event.bubbled,
      } satisfies InputResponse,
    };
  }

  serializeOutput(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    if (!event) {
      throw new Error("Unexpected empty output event while serializing run");
    }
    return {
      type: "output",
      data: {
        path: pathFromId(entry.id),
        timestamp: event.start,
        node: event.node.descriptor,
        outputs: event.inputs,
        bubbled: event.bubbled,
      } satisfies OutputResponse,
    };
  }

  serialize(sequence: Iterable<SequenceEntry>) {
    const seenGraphs = new Set<GraphUUID>();
    const timeline: TimelineEntry[] = [];
    for (const [type, entry] of sequence) {
      switch (type) {
        case "graphstart": {
          timeline.push(this.serializeGraphstart(entry, seenGraphs));
          break;
        }
        case "graphend": {
          timeline.push(this.serializeGraphend(entry));
          break;
        }
        case "nodestart": {
          timeline.push(this.serializeNodestart(entry));
          break;
        }
        case "input": {
          timeline.push(this.serializeInput(entry));
          break;
        }
        case "output": {
          timeline.push(this.serializeOutput(entry));
          break;
        }
        case "secret": {
          break;
        }
        case "nodeend": {
          break;
        }
        case "error": {
          break;
        }
      }
    }
  }

  oldSerialize(options: RunSerializationOptions): SerializedRun {
    const serialized: SerializedRun = {
      $schema: "tbd",
      version: "0",
      timeline: this.#timeline,
    };
    if (options.keepSecrets) return serialized;
    return replaceSecrets(serialized, () => {
      return crypto.randomUUID();
    });
  }
}

export const replaceSecrets = (
  data: SerializedRun,
  replacer: SerializedRunSecretReplacer
): SerializedRun => {
  const secretStore: Record<string, { to: string; from: string }> = {};

  const serializeSecrets = () => {
    return Object.fromEntries(
      Object.entries(secretStore).map(([key, value]) => {
        return [key, value.to];
      })
    );
  };

  const processPorts = (
    ports: Record<string, NodeValue>
  ): Record<string, NodeValue> => {
    if (!ports) return ports;
    return Object.fromEntries(
      Object.entries(ports).map(([key, value]) => {
        let stringified = JSON.stringify(value);
        for (const secret of Object.values(secretStore)) {
          stringified = stringified.replace(secret.from, secret.to);
        }
        return [key, JSON.parse(stringified)];
      })
    );
  };

  const timeline = data.timeline.map((entry) => {
    if (entry.type === "nodeend") {
      const data = entry.data as NodeEndResponse;
      // "node" has a "?"  only because when reading back loaded run,
      // "node" doesn't exist here (addNodeend doesn't use it).
      // TODO: make more elegant.
      if (data.node?.type === "secrets") {
        Object.entries(data.outputs).forEach(([key, value]) => {
          if (secretStore[key]) return;
          const from = value as string;
          const to = replacer(key, from);
          secretStore[key] = { from, to };
        });
      }

      return {
        type: "nodeend",
        data: {
          ...(entry.data as object),
          outputs: processPorts((entry.data as NodeEndResponse).outputs),
        },
      } as TimelineEntry;
    } else if (entry.type === "nodestart") {
      return {
        type: "nodestart",
        data: {
          ...(entry.data as object),
          inputs: processPorts((entry.data as NodeStartResponse).inputs),
        },
      } as TimelineEntry;
    }
    return entry;
  });

  const secrets = serializeSecrets();

  return { $schema: data.$schema, version: data.version, secrets, timeline };
};
