/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type {
  BBRTDriver,
  BBRTDriverSendOptions,
} from "../../../drivers/driver-interface.js";
import type { TurnChunk } from "../../../state/turn-chunk.js";
import "./install-promise-with-resolvers-polyfill.js";

type SyncHandler = (opts: BBRTDriverSendOptions) => TurnChunk[];
type AsyncHandler = (opts: BBRTDriverSendOptions) => AsyncIterable<TurnChunk>;

export class FakeDriver implements BBRTDriver {
  readonly id = "fake";
  readonly name = "Fake";
  readonly icon = "/bbrt/images/model.svg";

  #handlersWaitingForRequest: Array<AsyncHandler> = [];
  #requestsWaitingForHandler: Array<(handler: AsyncHandler) => void> = [];

  async *send(opts: BBRTDriverSendOptions): AsyncIterable<TurnChunk> {
    yield* (await this.#takeNextHandler())(opts);
  }

  async #takeNextHandler(): Promise<AsyncHandler> {
    if (this.#handlersWaitingForRequest.length > 0) {
      return this.#handlersWaitingForRequest.shift()!;
    } else {
      const request = Promise.withResolvers<AsyncHandler>();
      this.#requestsWaitingForHandler.push(request.resolve);
      return request.promise;
    }
  }

  handleNextRequest(handler: SyncHandler): Promise<void> {
    const handled = Promise.withResolvers<void>();
    const wrapped: AsyncHandler = async function* (opts) {
      for (const chunk of handler(opts)) {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
        yield chunk;
      }
      handled.resolve();
    };
    if (this.#requestsWaitingForHandler.length > 0) {
      this.#requestsWaitingForHandler.shift()!(wrapped);
    } else {
      this.#handlersWaitingForRequest.push(wrapped);
    }
    return handled.promise;
  }

  [Symbol.dispose]() {
    if (this.#requestsWaitingForHandler.length > 0) {
      throw new Error(
        "FakeDriver went out of scope before all requests were handled"
      );
    }
    if (this.#handlersWaitingForRequest.length > 0) {
      throw new Error(
        "FakeDriver went out of scope before all handlers were used"
      );
    }
  }
}
