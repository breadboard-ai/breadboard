/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { InspectableRunEvent, InspectableRunNodeEvent } from "./types.js";

export class EventManager {
  #events: InspectableRunEvent[] = [];
  #level = 0;

  #last(): InspectableRunNodeEvent {
    const event = this.#events[this.#events.length - 1];
    if (!event || event.type !== "node") {
      throw new Error("Expected a node event");
    }
    return event;
  }

  add(result: HarnessRunResult) {
    switch (result.type) {
      case "graphstart": {
        this.#level++;
        break;
      }
      case "graphend": {
        this.#level--;
        break;
      }
      case "nodestart": {
        if (this.#level === 1) {
          const event: InspectableRunNodeEvent = {
            type: "node",
            node: result.data.node,
            start: result.data.timestamp,
            end: null,
            inputs: result.data.inputs,
            outputs: null,
            result: null,
          };
          this.#events = [...this.#events, event];
        }
        break;
      }
      case "input":
      case "secret": {
        if (this.#level === 1) {
          const event = this.#last();
          event.result = result;
          this.#events = [...this.#events];
        }
        break;
      }
      case "nodeend": {
        if (this.#level === 1) {
          const event = this.#last();
          event.end = result.data.timestamp;
          event.outputs = result.data.outputs;
          event.result = null;
          this.#events = [...this.#events];
        }
        break;
      }
      case "error": {
        this.#events = [
          ...this.#events,
          {
            type: "error",
            error: result.data,
          },
        ];
        break;
      }
    }
  }

  get events() {
    return this.#events;
  }
}
