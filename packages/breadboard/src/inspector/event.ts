/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { HarnessRunResult } from "../harness/types.js";
import { PathRegistry } from "./path-registry.js";
import { InspectableRunEvent } from "./types.js";

export class EventManager {
  #registry = new PathRegistry();
  #level = 0;

  add(result: HarnessRunResult) {
    // Clean up after the `secret` event.
    // const maybeSecret = this.#events[this.#events.length - 1];
    // if (maybeSecret && maybeSecret.type === "secret") {
    //   maybeSecret.result = null;
    // }

    switch (result.type) {
      case "graphstart": {
        this.#registry.graphstart(result.data.path);
        this.#level++;
        break;
      }
      case "graphend": {
        this.#registry.graphend(result.data.path);
        this.#level--;
        break;
      }
      case "nodestart": {
        this.#registry.nodestart(result.data.path, result.data);
        break;
      }
      case "input": {
        this.#registry.input(result.data.path, result, result.data.bubbled);
        break;
      }
      case "secret": {
        this.#registry.secret({
          type: "secret",
          data: result.data,
          result,
        });
        break;
      }
      case "nodeend": {
        this.#registry.nodeend(result.data.path, result.data);
        break;
      }
      case "error": {
        this.#registry.error({
          type: "error",
          error: result.data,
        });
        break;
      }
    }
  }

  get events(): InspectableRunEvent[] {
    return this.#registry.events();
  }
}
