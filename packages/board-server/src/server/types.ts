/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  Kit,
  Outcome,
  ReanimationState,
} from "@google-labs/breadboard";
import type { RunDiagnosticsLevel } from "@google-labs/breadboard/harness";
import type { RemoteMessageWriter } from "@google-labs/breadboard/remote";
import type {
  InlineDataCapabilityPart,
  LLMContent,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";

import type { FirestoreStorageProvider } from "./storage-providers/firestore.js";

export type BoardId = {
  user: string;
  name: string;
  fullPath: string;
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
};

export type RunBoardArguments = {
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

export type BoardServerStore = FirestoreStorageProvider;

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

export type CreateBoardResult = {
  success: boolean;
  path: string | undefined;
  error: string | undefined;
};

export type CreateUserResult =
  | { success: true; apiKey: string }
  | { success: false; message: string };

export type CreateInviteResult =
  | {
      success: true;
      invite: string;
    }
  | {
      success: false;
      error: string;
    };

export type ListInviteResult =
  | {
      success: true;
      invites: string[];
    }
  | {
      success: false;
      error: string;
    };

export type PageMetadata = {
  title: string;
  description: string;
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
