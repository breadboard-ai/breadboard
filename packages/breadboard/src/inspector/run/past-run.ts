/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../../harness/types.js";
import {
  GraphUUID,
  InspectableRun,
  InspectableRunEvent,
  InspectableRunInputs,
  InspectableRunNodeEvent,
} from "../types.js";

export class PastRun implements InspectableRun {
  get graphId(): GraphUUID {
    throw new Error("Past runs can't yet provide graph IDs");
  }

  get graphVersion(): number {
    throw new Error("Past runs can't yet provide graph versions");
  }

  get start(): number {
    throw new Error("Past runs can't yet provide start times");
  }
  get end(): number {
    throw new Error("Past runs can't yet provide end times");
  }

  get events(): InspectableRunEvent[] {
    throw new Error("Past runs can't yet provide events");
  }

  get dataStoreGroupId(): number {
    throw new Error("Past runs can't yet provide data store group IDs");
  }

  currentNodeEvent(): InspectableRunNodeEvent | null {
    throw new Error("Past runs can't yet provide current node events");
  }

  stack(): InspectableRunNodeEvent[] {
    throw new Error("Past runs can't yet provide stack traces");
  }

  getEventById(): InspectableRunEvent | null {
    throw new Error("Past runs can't yet provide event IDs");
  }

  inputs(): InspectableRunInputs | null {
    throw new Error("Past runs can't yet provide inputs");
  }
  replay(): AsyncGenerator<HarnessRunResult> {
    throw new Error("Past runs can't yet provide replay");
  }
}
