/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Signal } from "signal-polyfill";
import { SignalArray } from "signal-utils/array";
import type { BBRTDriver } from "../drivers/driver-interface.js";
import type { BBRTTool, ToolInvocation } from "../tools/tool.js";
import { CachingMultiplexStream } from "../util/caching-multiplex-stream.js";
import { Lock } from "../util/lock.js";
import { coercePresentableError } from "../util/presentable-error.js";
import type { Result } from "../util/result.js";
import { transposeResults } from "../util/transpose-results.js";
import { waitForState } from "../util/wait-for-state.js";
import type { BBRTChunk } from "./chunk.js";
import type {
  BBRTModelTurn,
  BBRTToolCall,
  BBRTToolResponse,
  BBRTTurn,
  BBRTTurnStatus,
} from "./conversation-types.js";
import { BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION } from "./system-instruction.js";

export class BBRTConversation {
  readonly turns = new SignalArray<BBRTTurn>();
  readonly #lock = new Lock();
  readonly #driver: Signal.State<BBRTDriver>;
  readonly #activeTools: Signal.Computed<Set<BBRTTool>>;

  constructor(
    driver: Signal.State<BBRTDriver>,
    activeTools: Signal.Computed<Set<BBRTTool>>
  ) {
    this.#driver = driver;
    this.#activeTools = activeTools;
  }

  send(message: { content: string }): Promise<void> {
    // Serialize all requests with a lock. Note that a single call to #send can
    // generate many turns, because of tool calls.
    return this.#lock.do(() => this.#send(message));
  }

  async #send(
    message: { content: string } | { toolResponses: BBRTToolResponse[] }
  ): Promise<void> {
    // TODO(aomarks) We read this.#model and this.#tools across async boundaries
    // in this function, plus we recurse. We should have frozen copies of those
    // instead, and use them throughout. What's a good pattern for this problem
    // in general? Should we be factoring out a Sender class so that we can
    // replace it wholesale whenever the other two change, maybe with a computed
    // signal?

    // Create the user turn. (Note we only support sending either content or
    // tool responses in one message, not both).
    if ("toolResponses" in message) {
      this.turns.push({
        kind: "user-tool-responses",
        role: "user",
        status: new Signal.State<BBRTTurnStatus>("done"),
        responses: message.toolResponses,
      });
    } else {
      this.turns.push({
        kind: "user-content",
        role: "user",
        status: new Signal.State<BBRTTurnStatus>("done"),
        content: message.content,
      });
    }

    // Create the model turn (in anticipation).
    const status = new Signal.State<BBRTTurnStatus>("pending");
    const toolCalls = new SignalArray<BBRTToolCall>();
    const contentStream = new TransformStream<string, string>();
    const modelTurn: BBRTModelTurn = {
      kind: "model",
      role: "model",
      status,
      // Use BufferedMultiplexStream so that we can have as many consumers as
      // needed of the entire content stream.
      content: new CachingMultiplexStream(contentStream.readable),
      toolCalls,
    };
    this.turns.push(modelTurn);

    const modelResponse = await this.#generate();
    if (!modelResponse.ok) {
      status.set("error");
      const error = coercePresentableError(modelResponse.error);
      modelTurn.error = error;
      // TODO(aomarks) Use a new "using" statement for this, with broad scope.
      // Same for lock.
      void contentStream.writable.close();
      // TODO(aomarks) Hack because we don't yet render the error for a model
      // turn whose state is error. Can probably delete the error kind all
      // together.
      this.turns.push({
        kind: "error",
        role: "model",
        status,
        error,
      });
      return;
    }

    const contentWriter = contentStream.writable.getWriter();
    const toolResponsePromises: Array<Promise<Result<BBRTToolResponse>>> = [];
    for await (const chunk of modelResponse.value) {
      status.set("streaming");
      switch (chunk.kind) {
        case "append-content": {
          await contentWriter.write(chunk.content);
          break;
        }
        case "tool-call": {
          // TODO(aomarks) tools should be a Map, not a Set (throughout). Though
          // we should preserve order, so maybe it should be some other data
          // structure really.
          const tool = await (async () => {
            for (const tool of this.#activeTools.get()) {
              if (tool.metadata.id === chunk.name) {
                return tool;
              }
            }
            return undefined;
          })();
          if (tool === undefined) {
            console.error("unknown tool", JSON.stringify(chunk));
            this.turns.push({
              kind: "error",
              role: "model",
              status,
              error: new Error(`Unknown tool: ${JSON.stringify(chunk)}`),
            });
            break;
          }
          const invocation = tool.invoke(chunk.arguments);
          invocation.start();
          toolCalls.push({
            id: chunk.id,
            args: chunk.arguments,
            tool,
            invocation,
          });
          toolResponsePromises.push(
            this.#monitorInvocation(chunk.id, tool, chunk.arguments, invocation)
          );
          break;
        }
        default: {
          chunk satisfies never;
          console.error("unknown chunk kind:", chunk);
          break;
        }
      }
    }
    await contentWriter.close();
    if (toolResponsePromises.length === 0) {
      status.set("done");
    } else {
      status.set("using-tools");
      const toolResponses = transposeResults(
        await Promise.all(toolResponsePromises)
      );
      if (toolResponses.ok) {
        status.set("done");
        return this.#send({ toolResponses: toolResponses.value });
      } else {
        status.set("error");
        const error = coercePresentableError(toolResponses.error);
        modelTurn.error = error;
        // TODO(aomarks) Remove once we render errors directly on turns. Though,
        // be careful here, since if we add retry, we don't want to retry the
        // whole turn, just the model call. Maybe we need a turn role for tool
        // invocations?
        this.turns.push({
          kind: "error",
          role: "model",
          status,
          error,
        });
      }
    }
  }

  // TODO(aomarks) Kinda ugly. Should be simpler?
  async #monitorInvocation(
    id: string,
    tool: BBRTTool,
    args: unknown,
    invocation: ToolInvocation
  ): Promise<Result<BBRTToolResponse>> {
    const result = await waitForState(
      invocation.state,
      (state) => state.status === "success" || state.status === "error"
    );
    if (result.status === "success") {
      return {
        ok: true,
        value: { id, tool, invocation, args, response: result.value },
      };
    } else if (result.status === "error") {
      return { ok: false, error: result.error };
    } else {
      const msg = `Internal error: could not handle status ${result.status}`;
      console.error(msg);
      return {
        ok: false,
        error: new Error(msg),
      };
    }
  }

  async #generate(): Promise<Result<AsyncIterableIterator<BBRTChunk>>> {
    const driver = this.#driver.get();
    const chunks = await driver.executeTurn(
      this.turns,
      [...this.#activeTools.get()],
      BREADBOARD_ASSISTANT_SYSTEM_INSTRUCTION
    );
    if (!chunks.ok) {
      return chunks;
    }
    return { ok: true, value: chunks.value };
  }
}
