/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { InspectableRunObserver } from "../inspector/types.js";
import { Schema, InputValues } from "../types.js";
import type {
  HarnessRunner,
  HarnessRunResult,
  RunConfig,
  RunEventTarget,
} from "./types.js";
import {
  chunkRepairTransform,
  serverStreamEventDecoder,
} from "../remote/http.js";

export class HttpClient {
  #url: string;
  /**
   * The API key for the remote service.
   */
  #key: string;
  #fetch: typeof globalThis.fetch;
  /**
   * The ticket for the next request.
   */
  #next: string | null = null;

  constructor(
    url: string,
    key: string,
    fetch: typeof globalThis.fetch = globalThis.fetch
  ) {
    this.#url = url;
    this.#key = key;
    this.#fetch = fetch;
  }

  #createBody(inputs: InputValues): string {
    const body: InputValues = {
      ...inputs,
      $key: this.#key,
    };
    if (this.#next) {
      body.$next = this.#next;
    }
    return JSON.stringify(body);
  }

  async send(inputs: InputValues) {
    const response = await this.#fetch(this.#url, {
      method: "POST",
      body: this.#createBody(inputs),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    response.body
      ?.pipeThrough(new TextDecoderStream())
      .pipeThrough(chunkRepairTransform())
      .pipeThrough(serverStreamEventDecoder())
      .pipeTo(
        new WritableStream({
          write(chunk) {
            const data = JSON.parse(chunk);
          },
        })
      );

    return response.text();
  }
}

export class RemoteRunner
  extends (EventTarget as RunEventTarget)
  implements HarnessRunner
{
  #config: RunConfig;
  #observers: InspectableRunObserver[] = [];

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

  running(): boolean {
    throw new Error("Method not implemented.");
  }
  secretKeys(): string[] | null {
    throw new Error("Method not implemented.");
  }
  inputSchema(): Schema | null {
    throw new Error("Method not implemented.");
  }
  run(inputs?: InputValues): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
}
