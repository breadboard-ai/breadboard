/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriptor,
  OutputValues,
  RunInputEvent,
  RunNodeStartEvent,
  RunOutputEvent,
} from "@breadboard-ai/types";
import type { ComponentActivityItem, NodeLogEntry } from "../../types/types";
import { idFromPath } from "./top-graph-observer";

// List the exports here to make them visible at a glance.
export { EndNodeEntry, NodeEntry, UserNodeEntry };

class NodeEntry implements NodeLogEntry {
  type: "node";
  id: string;
  descriptor: NodeDescriptor;
  hidden: boolean;
  outputs: OutputValues | null;
  inputs?: InputValues;
  start: number;
  bubbled: boolean;
  end: number | null;
  activity: ComponentActivityItem[] = [];

  constructor(event: RunInputEvent | RunOutputEvent | RunNodeStartEvent) {
    this.type = "node";
    this.id = idFromPath(event.data.path);
    this.descriptor = event.data.node;
    this.start = event.data.timestamp;
    this.end = null;

    const type = this.descriptor.type;
    switch (type) {
      case "input": {
        const inputEvent = event as RunInputEvent;
        this.inputs = inputEvent.data.inputArguments;
        this.bubbled = inputEvent.data.bubbled;
        break;
      }
      case "output": {
        const outputEvent = event as RunOutputEvent;
        this.inputs = outputEvent.data.outputs;
        this.end = event.data.timestamp;
        this.bubbled = outputEvent.data.bubbled;
        break;
      }
      default: {
        this.bubbled = false;
      }
    }
    this.outputs = null;
    this.hidden = false;
  }

  title(): string {
    return this.descriptor.metadata?.title || this.descriptor.id;
  }
}

class UserNodeEntry extends NodeEntry {
  constructor(event: RunInputEvent) {
    super(event);
    this.descriptor = structuredClone(this.descriptor);
    this.descriptor.type = "user";
  }

  title(): string {
    return "User";
  }
}

class EndNodeEntry implements NodeLogEntry {
  type = "node" as const;
  id: string = "end";
  activity: ComponentActivityItem[] = [];
  descriptor = {
    id: "end",
    metadata: {
      title: "End",
    },
    type: "end",
  };
  hidden = false;
  start = globalThis.performance.now();
  bubbled = false;
  end = globalThis.performance.now();

  constructor(reason: string) {
    this.descriptor.metadata!.title = reason;
  }

  title(): string {
    return this.descriptor.metadata!.title!;
  }
}
