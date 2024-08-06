/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  HarnessRunner,
  HarnessRunResult,
  RunConfig,
  RunEventTarget,
} from "./types.js";
import { run } from "./run.js";
import { InputValues, Schema } from "../types.js";
import {
  EndEvent,
  InputEvent,
  GraphEndEvent,
  GraphStartEvent,
  NodeEndEvent,
  NodeStartEvent,
  OutputEvent,
  RunnerErrorEvent,
  SecretEvent,
  SkipEvent,
  PauseEvent,
  ResumeEvent,
  StartEvent,
} from "./events.js";
import { InspectableRunObserver } from "../inspector/types.js";

export const now = () => ({ timestamp: globalThis.performance.now() });

export class LocalRunner
  extends (EventTarget as RunEventTarget)
  implements HarnessRunner
{
  #config: RunConfig;
  #observers: InspectableRunObserver[] = [];
  #run: ReturnType<typeof run> | null = null;
  #pendingResult: HarnessRunResult | null = null;

  /**
   * Initialize the runner.
   * This does not start the runner.
   *
   * @param config -- configuration for the run
   */
  constructor(config: RunConfig) {
    super();
    this.#config = config;
  }

  addObserver(observer: InspectableRunObserver): void {
    this.#observers.push(observer);
  }

  async #notifyObservers(result: HarnessRunResult) {
    for (const observer of this.#observers) {
      try {
        await observer.observe(result);
      } catch (e) {
        console.error("Observer failed to observe result", result, e);
      }
    }
  }

  secretKeys(): string[] | null {
    if (!this.#pendingResult || this.#pendingResult.type !== "secret") {
      return null;
    }
    return this.#pendingResult.data.keys;
  }

  inputSchema(): Schema | null {
    if (!this.#pendingResult || this.#pendingResult.type !== "input") {
      return null;
    }
    return this.#pendingResult.data.inputArguments.schema || null;
  }

  running() {
    return !!this.#run && !this.#pendingResult;
  }

  async run(inputs?: InputValues): Promise<boolean> {
    const starting = !this.#run;
    if (!this.#run) {
      this.#run = run(this.#config);
    } else if (this.#pendingResult) {
      this.#pendingResult.reply({ inputs: inputs ?? {} });
      inputs = undefined;
    }
    this.#pendingResult = null;

    this.dispatchEvent(
      starting ? new StartEvent(now()) : new ResumeEvent(now())
    );

    for (;;) {
      const result = await this.#run.next();
      if (result.done) {
        this.#run = null;
        this.#pendingResult = null;
        return true;
      }
      await this.#notifyObservers(result.value);
      const { type, data, reply } = result.value;
      switch (type) {
        case "input": {
          if (inputs) {
            // When there are inputs to consume, consume them and
            // continue the run.
            this.dispatchEvent(new InputEvent(true, data));
            reply({ inputs });
            inputs = undefined;
          } else {
            // When there are no inputs to consume, pause the run
            // and wait for the next input.
            this.dispatchEvent(new InputEvent(false, data));
            this.#pendingResult = result.value;
            this.dispatchEvent(new PauseEvent(false, now()));
            return false;
          }
          break;
        }
        case "error": {
          this.dispatchEvent(new RunnerErrorEvent(data));
          break;
        }
        case "end": {
          this.dispatchEvent(new EndEvent(data));
          break;
        }
        case "skip": {
          this.dispatchEvent(new SkipEvent(data));
          break;
        }
        case "graphstart": {
          this.dispatchEvent(new GraphStartEvent(data));
          break;
        }
        case "graphend": {
          this.dispatchEvent(new GraphEndEvent(data));
          break;
        }
        case "nodestart": {
          this.dispatchEvent(new NodeStartEvent(data));
          break;
        }
        case "nodeend": {
          this.dispatchEvent(new NodeEndEvent(data));
          break;
        }
        case "output": {
          this.dispatchEvent(new OutputEvent(data));
          break;
        }
        case "secret": {
          if (inputs) {
            // When there are inputs to consume, consume them and
            // continue the run.
            this.dispatchEvent(new SecretEvent(true, data));
            reply({ inputs });
            inputs = undefined;
          } else {
            // When there are no inputs to consume, pause the run
            // and wait for the next input.
            this.dispatchEvent(new SecretEvent(false, data));
            this.#pendingResult = result.value;
            this.dispatchEvent(new PauseEvent(false, now()));
            return false;
          }
          break;
        }
      }
    }
  }
}
