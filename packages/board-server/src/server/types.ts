/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InlineDataCapabilityPart,
  InputValues,
  Kit,
  LLMContent,
  Outcome,
  ReanimationState,
  RemoteMessageWriter,
  RunDiagnosticsLevel,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";

export type BoardId = {
  user: string;
  name: string;
};

export type SecretInputs = {
  keys: string[];
};

export type BoardServerLoadFunction = (
  path: string
) => Promise<GraphDescriptor | null>;

export type InvokeBoardArguments = {
  url: string;
  path: string;
  loader: BoardServerLoadFunction;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: Record<string, any>;
  kitOverrides?: Kit[];
  serverUrl: string;
};

export type RunBoardArguments = {
  serverUrl: string;
  /**
   * The full URL or the requested board, like
   * `https://board.server/boards/@user/board.bgl.json`.
   */
  url: string;
  /**
   * The path to the board, like `@user/board.bgl.json`.
   */
  path: string;
  /**
   * The user who is running the board.
   */
  user: string;
  /**
   * The function that supplies the actual board given the path.
   */
  loader: BoardServerLoadFunction;
  /**
   * The state store for graph reanimation.
   */
  runStateStore: RunBoardStateStore;
  /**
   * The writer for the results of the board run.
   */
  writer: RemoteMessageWriter;
  inputs?: InputValues;
  kitOverrides?: Kit[];
  next?: string;
  diagnostics?: RunDiagnosticsLevel;
};

export type RunBoardStateStore = {
  loadReanimationState(
    user: string,
    ticket: string
  ): Promise<ReanimationState | undefined>;
  saveReanimationState(user: string, state: ReanimationState): Promise<string>;
};

export type BlobStore = {
  saveData(
    data: InlineDataCapabilityPart
  ): Promise<Outcome<StoredDataCapabilityPart>>;
  deflateContent(content: LLMContent): Promise<Outcome<LLMContent>>;
  saveBuffer(buffer: Buffer, contentType: string): Promise<Outcome<string>>;
  getBlob(blobId: string): Promise<Outcome<BlobStoreGetResult>>;
};

export type BlobStoreGetResult = {
  data: Buffer;
  mimeType?: string;
};

export type Result<T> =
  | {
      success: false;
      error: string;
    }
  | {
      success: true;
      result: T;
    };
