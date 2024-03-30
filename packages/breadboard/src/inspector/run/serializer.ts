/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeValue } from "@google-labs/breadboard-schema/graph.js";
import {
  GraphUUID,
  TimelineEntry,
  RunSerializationOptions,
  SerializedRun,
  SerializedRunSecretReplacer,
} from "../types.js";
import {
  GraphStartProbeData,
  NodeEndResponse,
  NodeStartResponse,
} from "../../types.js";

export class RunSerializer {
  #timeline: TimelineEntry[] = [];
  #graphs: Map<GraphUUID, boolean> = new Map();

  #remember(entry: TimelineEntry) {
    this.#timeline.push(entry);
  }

  addGraphstart(data: GraphStartProbeData, graphId: GraphUUID) {
    this.#remember({ type: "graphstart", data, graphId });
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

  serialize(options: RunSerializationOptions): SerializedRun {
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
