/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  InputValues,
  NodeDescriptor,
  OutputValues,
  Schema,
} from "@google-labs/breadboard";
import type { RunOutputEvent, RunInputEvent } from "@breadboard-ai/types";
import { idFromPath } from "./top-graph-observer";
import type { EdgeLogEntry } from "../../types/types";

// List the exports here to make them visible at a glance.
export { EdgeEntry, BubbledOutputEdge, BubbledInputEdge, InputEdge };

class EdgeEntry implements EdgeLogEntry {
  type = "edge" as const;
  value?: InputValues | undefined;
  end = null;
}

class BubbledOutputEdge implements EdgeLogEntry {
  type = "edge" as const;
  value?: OutputValues | undefined;
  schema: Schema | undefined;
  end: number;
  descriptor?: NodeDescriptor | undefined;

  constructor(event: RunOutputEvent) {
    this.descriptor = event.data.node;
    this.schema = event.data.node.configuration?.schema as Schema;
    this.value = event.data.outputs;
    this.end = event.data.timestamp;
  }
}

class BubbledInputEdge implements EdgeLogEntry {
  type = "edge" as const;
  id: string;
  value: InputValues | undefined;
  schema: Schema | undefined;
  end: number | null;
  descriptor?: NodeDescriptor | undefined;

  constructor(event: RunInputEvent) {
    this.descriptor = event.data.node;
    this.schema = event.data.inputArguments.schema;
    this.id = idFromPath(event.data.path);
    this.end = null;
  }
}

class InputEdge implements EdgeLogEntry {
  type = "edge" as const;
  id: string;
  value: InputValues | undefined;
  schema: Schema | undefined;
  end: number | null;
  descriptor?: NodeDescriptor | undefined;

  constructor(event: RunInputEvent, initialValue?: InputValues | null) {
    this.descriptor = event.data.node;
    this.schema = event.data.inputArguments.schema as Schema;
    this.id = idFromPath(event.data.path);
    if (initialValue) {
      this.value = initialValue;
    }
    this.end = null;
  }
}
