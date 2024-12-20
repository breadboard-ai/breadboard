/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import type { ArtifactHandle } from "../../../artifacts/artifact-interface.js";
import type {
  BBRTTool,
  BBRTToolAPI,
  BBRTToolMetadata,
} from "../../../tools/tool-types.js";
import type { JsonSerializableObject } from "../../../util/json-serializable.js";
import type { Result } from "../../../util/result.js";

type Handler = (
  opts: JsonSerializableObject
) => Promise<JsonSerializableObject>;

export class FakeTool implements BBRTTool {
  #handlersWaitingForRequest: Array<Handler> = [];
  #requestsWaitingForHandler: Array<(handler: Handler) => void> = [];

  readonly metadata: BBRTToolMetadata;

  constructor(id = "fake") {
    this.metadata = {
      id,
      title: "Fake Tool",
      description: "A fake tool for testing.",
    };
  }

  async api(): Promise<Result<BBRTToolAPI>> {
    return {
      ok: true,
      value: {
        inputSchema: {
          type: "object",
          properties: {},
        },
        outputSchema: {
          type: "object",
          properties: {},
        },
      },
    };
  }

  execute(args: JsonSerializableObject): {
    result: Promise<
      Result<{
        data: JsonSerializableObject;
        artifacts: ArtifactHandle[];
      }>
    >;
  } {
    return {
      result: this.#takeNextHandler().then(async (handler) => ({
        ok: true,
        value: {
          data: await handler(args),
          artifacts: [],
        },
      })),
    };
  }

  async #takeNextHandler(): Promise<Handler> {
    if (this.#handlersWaitingForRequest.length > 0) {
      return this.#handlersWaitingForRequest.shift()!;
    } else {
      const request = Promise.withResolvers<Handler>();
      this.#requestsWaitingForHandler.push(request.resolve);
      return request.promise;
    }
  }

  handleNextRequest(handler: Handler): Promise<void> {
    const handled = Promise.withResolvers<void>();
    const wrapped: Handler = async (args) => {
      const result = await handler(args);
      handled.resolve();
      return result;
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
        "FakeTool went out of scope before all requests were handled"
      );
    }
    if (this.#handlersWaitingForRequest.length > 0) {
      throw new Error(
        "FakeTool went out of scope before all handlers were used"
      );
    }
  }
}
