/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
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
  NextEvent,
} from "./events.js";
import { InspectableRunObserver } from "../inspector/types.js";
import { timestamp } from "../timestamp.js";

export class LocalRunner
  extends (EventTarget as RunEventTarget)
  implements HarnessRunner
{
  #config: RunConfig;
  #observers: InspectableRunObserver[] = [];
  #run: ReturnType<typeof run> | null = null;
  #pendingResult: HarnessRunResult | null = null;
  #inRun = false;
  #resumeWith: InputValues | undefined;

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
    if (this.#inRun) {
      this.#resumeWith = inputs;
      return false;
    }
    this.#inRun = true;
    try {
      const eventArgs = {
        inputs,
        timestamp: timestamp(),
      };
      const starting = !this.#run;

      if (!this.#run) {
        this.#run = run(this.#config);
      } else if (this.#pendingResult) {
        this.#pendingResult.reply({ inputs: inputs ?? {} });
        inputs = undefined;
        this.#observers.forEach((observer) => {
          observer.resume?.();
        });
      }
      this.#pendingResult = null;

      this.dispatchEvent(
        starting ? new StartEvent(eventArgs) : new ResumeEvent(eventArgs)
      );

      for (;;) {
        console.assert(
          this.#run,
          "Expected run to exist. If not, we might be having a re-entrant run."
        );
        const result = await this.#run.next();
        this.dispatchEvent(new NextEvent(result.value));
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
              this.#pendingResult = result.value;
              this.dispatchEvent(new InputEvent(false, data));
              if (this.#resumeWith) {
                reply({ inputs: this.#resumeWith });
                this.#pendingResult = null;
                this.#resumeWith = undefined;
              } else {
                this.dispatchEvent(
                  new PauseEvent(false, {
                    timestamp: timestamp(),
                  })
                );
                return false;
              }
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
            this.dispatchEvent(new NodeStartEvent(data, result.value.result));
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
              this.#pendingResult = result.value;
              this.dispatchEvent(new SecretEvent(false, data));
              if (this.#resumeWith) {
                reply({ inputs: this.#resumeWith });
                this.#pendingResult = null;
                this.#resumeWith = undefined;
              } else {
                this.dispatchEvent(
                  new PauseEvent(false, {
                    timestamp: timestamp(),
                  })
                );
                return false;
              }
            }
            break;
          }
        }
      }
    } finally {
      this.#inRun = false;
    }
  }
}
