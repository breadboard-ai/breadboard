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

export const now = () => ({ timestamp: globalThis.performance.now() });

export class LocalRunner
  extends (EventTarget as RunEventTarget)
  implements HarnessRunner
{
  #config: RunConfig;
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

  /**
   * A convenience method to get the secret keys that the runner is
   * waiting for. This information can also be obtained by listening to
   * the `secret` event.
   *
   * Returns null if the runner is not waiting for any secrets.
   *
   * @returns -- set of secret keys that the runner is waiting for, or null.
   */
  secretKeys(): string[] | null {
    if (!this.#pendingResult || this.#pendingResult.type !== "secret") {
      return null;
    }
    return this.#pendingResult.data.keys;
  }

  /**
   * A convenience method to get the input schema that the runner is
   * waiting for. This information can also be obtained by listening to
   * the `input` event.
   *
   * Returns null if the runner is not waiting for any inputs.
   *
   * @returns -- the input schema that the runner is waiting for, or null.
   */
  inputSchema(): Schema | null {
    if (!this.#pendingResult || this.#pendingResult.type !== "input") {
      return null;
    }
    return this.#pendingResult.data.inputArguments.schema || null;
  }

  /**
   * Check if the runner is running or not.
   *
   * @returns -- true if the runner is currently running, or false otherwise.
   */
  running() {
    return !!this.#run && !this.#pendingResult;
  }

  /**
   * The main method for this class. It starts or resumes the runner.
   * If the runner is waiting for input, the input arguments will be used
   * to provide the input values.
   *
   * If the runner is done, it will return true. If the runner is waiting
   * for input or secret, it will return false.
   *
   * @param inputs -- input values to provide to the runner.
   * @returns -- true if the runner is done, or false if it is waiting
   *             for input.
   */
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
