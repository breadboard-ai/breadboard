/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalArray } from "signal-utils/array";
import { ReactiveFunctionCallState } from "./function-call.js";
import {
  ReactiveTurnChunk,
  type TurnChunk,
  type TurnChunkError,
} from "./turn-chunk.js";

/**
 * JSON-serializable data for a streaming turn.
 */
export interface TurnState {
  role: "user" | "model";
  status: "pending" | "done";
  chunks: TurnChunk[];
}

/**
 * Wrapper around {@link TurnState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveTurnState implements TurnState {
  readonly role: TurnState["role"];
  @signal accessor status: TurnState["status"];
  readonly chunks: SignalArray<ReactiveTurnChunk>;

  constructor({ role, status, chunks }: TurnState) {
    this.role = role;
    this.status = status;
    this.chunks = new SignalArray(
      chunks.map((chunk) =>
        chunk.kind === "function-call"
          ? {
              kind: "function-call",
              timestamp: chunk.timestamp,
              call: new ReactiveFunctionCallState(chunk.call),
            }
          : chunk
      )
    );
  }

  get data(): TurnState {
    return {
      role: this.role,
      status: this.status,
      chunks: this.chunks.map((chunk) =>
        chunk.kind === "function-call"
          ? {
              kind: "function-call",
              timestamp: chunk.timestamp,
              call: chunk.call.data,
            }
          : chunk
      ),
    };
  }

  /**
   * The text we have accumulated so far (signal-reactive).
   */
  get partialText(): string {
    while (this.#textStartIndex < this.chunks.length) {
      const event = this.chunks[this.#textStartIndex]!;
      if (event.kind === "text") {
        this.#textAccumulator += event.text;
      }
      this.#textStartIndex++;
    }
    return this.#textAccumulator;
  }
  #textAccumulator = "";
  #textStartIndex = 0;

  /**
   * The function calls we have accumulated so far (signal-reactive).
   */
  get partialFunctionCalls(): ReadonlyArray<ReactiveFunctionCallState> {
    const length = this.chunks.length;
    for (let i = this.#functionCallsNextStartIndex; i < length; i++) {
      const event = this.chunks[i]!;
      if (event.kind === "function-call") {
        this.#functionCallsAccumulator.push(event.call);
      }
    }
    this.#functionCallsNextStartIndex = length;
    return this.#functionCallsAccumulator;
  }
  #functionCallsAccumulator: ReactiveFunctionCallState[] = [];
  #functionCallsNextStartIndex = 0;

  /**
   * The errors we have accumulated so far (signal-reactive).
   */
  get partialErrors(): ReadonlyArray<TurnChunkError> {
    const length = this.chunks.length;
    for (let i = this.#errorsNextStartIndex; i < length; i++) {
      const event = this.chunks[i]!;
      if (event.kind === "error") {
        this.#errorsAccumulator.push(event);
      }
    }
    this.#errorsNextStartIndex = length;
    return this.#errorsAccumulator;
  }
  #errorsAccumulator: TurnChunkError[] = [];
  #errorsNextStartIndex = 0;
}
