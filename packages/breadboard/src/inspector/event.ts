/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import {
  InspectableRun,
  InspectableRunErrorEvent,
  InspectableRunEvent,
  InspectableRunNodeEvent,
  InspectableRunSecretEvent,
} from "./types.js";

type EventWithPath = InspectableRunNodeEvent & { path: number[] };

type Events = (
  | EventWithPath
  | InspectableRunErrorEvent
  | InspectableRunSecretEvent
)[];

export class EventManager {
  #createRun: () => InspectableRun;

  constructor(runFactory: () => InspectableRun) {
    this.#createRun = runFactory;
  }

  #events: Events = [];
  #level = 0;

  #lastAsNode(): EventWithPath {
    const event = this.#events[this.#events.length - 1];
    if (!event || event.type !== "node") {
      throw new Error("Expected a node event");
    }
    return event;
  }

  add(result: HarnessRunResult) {
    // Clean up after the `secret` event.
    const maybeSecret = this.#events[this.#events.length - 1];
    if (maybeSecret && maybeSecret.type === "secret") {
      maybeSecret.result = null;
    }

    switch (result.type) {
      case "graphstart": {
        if (this.#level !== 0) {
          const lastPath = this.#lastAsNode().path;
          console.log("GRAPHSTART", result.data.path, lastPath);
        }
        this.#level++;
        break;
      }
      case "graphend": {
        this.#level--;
        break;
      }
      case "nodestart": {
        if (this.#level === 1) {
          const event: EventWithPath = {
            type: "node",
            node: result.data.node,
            start: result.data.timestamp,
            end: null,
            inputs: result.data.inputs,
            outputs: null,
            result: null,
            bubbled: false,
            nested: null,
            path: structuredClone(result.data.path),
          };
          this.#events = [...this.#events, event];
        }
        break;
      }
      case "input": {
        const last = this.#events[this.#events.length - 1];
        if (last.type !== "node" || last.node.type !== result.type) {
          // This is a bubbled input.
          // Create a "bubbled" event for it.
          const event: EventWithPath = {
            type: "node",
            node: result.data.node,
            start: result.data.timestamp,
            // Because it is bubbled, it will not have a corresponding
            // "nodeend" event.
            end: result.data.timestamp,
            inputs: result.data.inputArguments,
            // TODO: Find a way to populate this field. Currently, this event
            // will have no outputs.
            outputs: null,
            result,
            bubbled: true,
            nested: null,
            path: [],
          };
          this.#events = [...this.#events, event];
        }
        break;
      }
      case "secret": {
        const event: InspectableRunSecretEvent = {
          type: "secret",
          data: result.data,
          result,
        };
        this.#events = [...this.#events, event];
        break;
      }
      case "nodeend": {
        if (this.#level === 1) {
          const event = this.#lastAsNode();
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

  get events(): InspectableRunEvent[] {
    return this.#events;
  }
}
