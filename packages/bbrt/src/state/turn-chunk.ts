/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PresentableError } from "../util/presentable-error.js";
import type {
  FunctionCallState,
  ReactiveFunctionCallState,
} from "./function-call.js";

/**
 * A chunk of content, or a function call, or any other kind of event that can
 * happen during a streaming turn.
 */
export type TurnChunk =
  | TurnChunkText
  | TurnChunkFunctionCall
  | TurnChunkError
  | TurnChunkFinished;

export type ReactiveTurnChunk =
  | TurnChunkText
  | ReactiveTurnChunkFunctionCall
  | TurnChunkError
  | TurnChunkFinished;

export interface TurnChunkBase {
  readonly kind: TurnChunk["kind"];
  readonly timestamp: number;
}

/**
 * A fragment of text has been emitted for accumulation into the main text
 * output.
 */
export interface TurnChunkText extends TurnChunkBase {
  readonly kind: "text";
  readonly text: string;
}

/**
 * A function call request was made.
 */
export interface TurnChunkFunctionCall extends TurnChunkBase {
  readonly kind: "function-call";
  readonly call: FunctionCallState;
}

/**
 * A function call request was made.
 */
export interface ReactiveTurnChunkFunctionCall extends TurnChunkBase {
  readonly kind: "function-call";
  readonly call: ReactiveFunctionCallState;
}

/**
 * The turn was explicitly finished.
 */
export interface TurnChunkFinished extends TurnChunkBase {
  readonly kind: "finished";
}

/**
 * An error occured.
 */
export interface TurnChunkError extends TurnChunkBase {
  readonly kind: "error";
  readonly error: PresentableError;
}
