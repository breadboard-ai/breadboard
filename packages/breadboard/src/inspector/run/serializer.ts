/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GraphDescriptor,
  NodeDescriptor,
  NodeValue,
  GraphEndProbeData,
  NodeEndResponse,
} from "@breadboard-ai/types";
import {
  TimelineEntry,
  RunSerializationOptions,
  SerializedRun,
  SerializedRunSecretReplacer,
  PathRegistryEntry,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
  InspectableRunErrorEvent,
  MainGraphIdentifier,
} from "../types.js";
import { ErrorResponse, InputResponse, OutputResponse } from "../../types.js";
import { SecretResult } from "../../harness/types.js";
import { SerializedDataStoreGroup } from "../../data/types.js";
import { idFromPath } from "./conversions.js";

export type SequenceEntry = [type: TimelineEntry[0], entry: PathRegistryEntry];

export class RunSerializer {
  #seenGraphs = new Map<MainGraphIdentifier, number>();
  #graphIndex = 0;

  #graphIndexFromEntry(entry: PathRegistryEntry) {
    const graphEntry = entry.parent;
    if (!graphEntry) {
      throw new Error(
        `Unknown graph entry for "${idFromPath(entry.path)}" when serializing.`
      );
    }
    const graphId = graphEntry.mainGraphId;
    if (!graphId) {
      throw new Error(
        `Unknown graphId for "${idFromPath(entry.path)}" when serializing.`
      );
    }
    const graph = this.#seenGraphs.get(graphId);
    if (graph === undefined) {
      throw new Error(
        `Unknown graph for "${idFromPath(entry.path)}" when serializing.`
      );
    }
    return graph;
  }

  #simpleDescriptor(event: InspectableRunNodeEvent) {
    return { id: event.node.descriptor.id } as NodeDescriptor;
  }

  serializeGraphstart(entry: PathRegistryEntry): TimelineEntry {
    const { mainGraphId } = entry;
    if (mainGraphId === null) {
      throw new Error("Encountered an empty graphId during graphstart.");
    }
    let graph: GraphDescriptor | null = null;
    let index: number;
    if (!this.#seenGraphs.has(mainGraphId)) {
      graph = entry.graph?.mainGraphDescriptor() || null;
      index = this.#graphIndex++;
      this.#seenGraphs.set(mainGraphId, index);
    } else {
      index = this.#seenGraphs.get(mainGraphId) || 0;
    }
    const edges = entry.edges;
    const graphId = entry.graphId;
    return [
      "graphstart",
      {
        timestamp: entry.graphStart,
        path: entry.path,
        index,
        graph,
        graphId,
        edges,
      },
    ];
  }

  serializeGraphend(entry: PathRegistryEntry): TimelineEntry {
    return [
      "graphend",
      {
        path: entry.path,
        timestamp: entry.graphEnd as number,
      } satisfies GraphEndProbeData,
    ];
  }

  serializeNodestart(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    const { inputs, start: timestamp } = event;
    const node = event.node.descriptor.id;
    const graph = this.#graphIndexFromEntry(entry);
    return [
      "nodestart",
      { id: node, graph, inputs, path: entry.path, timestamp },
    ];
  }

  serializeInput(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    if (!event) {
      throw new Error("Unexpected empty input event while serializing run");
    }
    return [
      "input",
      {
        path: entry.path,
        timestamp: event.start, // TODO: make sure these match in the runner.
        node: this.#simpleDescriptor(event),
        inputArguments: event.inputs,
        bubbled: event.bubbled,
      } satisfies InputResponse,
    ];
  }

  serializeOutput(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    if (!event) {
      throw new Error("Unexpected empty output event while serializing run");
    }
    return [
      "output",
      {
        path: entry.path,
        timestamp: event.start,
        node: this.#simpleDescriptor(event),
        outputs: event.inputs,
        bubbled: event.bubbled,
      } satisfies OutputResponse,
    ];
  }

  serializeSecret(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunSecretEvent;
    if (!event) {
      throw new Error("Unexpected empty secret event while serializing run");
    }
    return [
      "secret",
      {
        keys: event.keys,
        timestamp: event.start,
      } satisfies SecretResult["data"],
    ];
  }

  serializeNodeend(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunNodeEvent;
    if (!event) {
      throw new Error("Unexpected empty nodeend event while serializing run");
    }
    return [
      "nodeend",
      {
        path: entry.path,
        timestamp: event.end as number,
        outputs: event.outputs,
        node: {
          type: event.node.descriptor.type,
          id: event.node.descriptor.id,
        },
        newOpportunities: event.traversalResult?.newOpportunities || [],
      },
    ];
  }

  serializeError(entry: PathRegistryEntry): TimelineEntry {
    const event = entry.event as InspectableRunErrorEvent;
    if (!event) {
      throw new Error("Unexpected empty error event while serializing run");
    }
    return [
      "error",
      {
        error: event.error,
        timestamp: event.start,
      } satisfies ErrorResponse,
    ];
  }

  serialize(
    sequence: Iterable<SequenceEntry>,
    data: SerializedDataStoreGroup | null,
    options: RunSerializationOptions
  ) {
    const timeline: TimelineEntry[] = [];
    for (const [type, entry] of sequence) {
      switch (type) {
        case "graphstart": {
          timeline.push(this.serializeGraphstart(entry));
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
          timeline.push(this.serializeSecret(entry));
          break;
        }
        case "nodeend": {
          timeline.push(this.serializeNodeend(entry));
          break;
        }
        case "error": {
          timeline.push(this.serializeError(entry));
          break;
        }
      }
    }
    const serialized: SerializedRun = {
      $schema: "tbd",
      version: "0",
      timeline,
    };
    if (data) {
      serialized.data = data;
    }
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

  const timeline: TimelineEntry[] = data.timeline.map((entry) => {
    const [type, d] = entry;
    if (type === "nodeend") {
      const data = d as NodeEndResponse;
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

      return [
        "nodeend",
        {
          ...(d as object),
          outputs: processPorts(data.outputs),
        },
      ];
    } else if (type === "nodestart") {
      return [
        "nodestart",
        {
          ...(d as object),
          inputs: processPorts(d.inputs),
        },
      ] as TimelineEntry;
    }
    return entry as TimelineEntry;
  });

  const secrets = serializeSecrets();

  const result: SerializedRun = {
    $schema: data.$schema,
    version: data.version,
    secrets,
    timeline,
  };
  if (data.data) {
    result.data = data.data;
  }
  return result;
};
