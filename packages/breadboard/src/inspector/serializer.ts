/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeValue } from "@google-labs/breadboard-schema/graph.js";
import { HistoryEntry, SerializedRun } from "./types.js";
import { NodeEndResponse, NodeStartResponse } from "../types.js";

export class RunSerializer {
  #timeline: HistoryEntry[] = [];
  #secrets: Record<string, { secret: string; sentinel: string }> = {};

  #remember(type: HistoryEntry["type"], data?: unknown) {
    this.#timeline.push({ type, data });
  }

  addGraphstart(data: unknown) {
    this.#remember("graphstart", data);
  }

  addGraphend(data: unknown) {
    this.#remember("graphend", data);
  }

  #replaceSecrets(ports: Record<string, NodeValue>): Record<string, NodeValue> {
    if (!ports) return ports;
    return Object.fromEntries(
      Object.entries(ports).map(([key, value]) => {
        let stringified = JSON.stringify(value);
        for (const secret of Object.values(this.#secrets)) {
          stringified = stringified.replace(secret.secret, "NOPE");
        }
        return [key, JSON.parse(stringified)];
      })
    );
  }

  addNodestart(data: NodeStartResponse) {
    this.#remember("nodestart", data);
  }

  addNodeend(data: NodeEndResponse) {
    const outputs = data.outputs;
    // "node" has a "?"  only because when reading back loaded run,
    // "node" doesn't exist here (addNodeend doesn't use it).
    // TODO: make more elegant.
    if (data.node?.type === "secrets") {
      Object.entries(data.outputs).map(([key, value]) => {
        this.#secrets[key] = {
          secret: value as string,
          sentinel: crypto.randomUUID(),
        };
      });
    }
    this.#remember("nodeend", {
      timestamp: data.timestamp,
      outputs,
      path: data.path,
    });
  }

  addInput(data: unknown) {
    this.#remember("input", data);
  }

  addOutput(data: unknown) {
    this.#remember("output", data);
  }

  addSecret(data: unknown) {
    this.#remember("secret", data);
  }

  addError(data: unknown) {
    this.#remember("error", data);
  }

  #serializeSecrets() {
    return Object.fromEntries(
      Object.entries(this.#secrets).map(([key, value]) => {
        return [key, value.sentinel];
      })
    );
  }

  #serializeTimeline(): HistoryEntry[] {
    return this.#timeline.map((entry) => {
      if (entry.type === "nodeend") {
        return {
          type: "nodeend",
          data: {
            ...(entry.data as object),
            outputs: this.#replaceSecrets(
              (entry.data as NodeEndResponse).outputs
            ),
          },
        };
      } else if (entry.type === "nodestart") {
        return {
          type: "nodestart",
          data: {
            ...(entry.data as object),
            inputs: this.#replaceSecrets(
              (entry.data as NodeStartResponse).inputs
            ),
          },
        };
      }
      return entry;
    });
  }

  serialize(): SerializedRun {
    return {
      $schema: "tbd",
      version: "0",
      timeline: this.#serializeTimeline(),
      secrets: this.#serializeSecrets(),
    };
  }
}
