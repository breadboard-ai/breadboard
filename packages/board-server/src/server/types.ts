/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  GraphDescriptor,
  InputValues,
  Kit,
  ReanimationState,
} from "@google-labs/breadboard";
import type { RunDiagnosticsLevel } from "@google-labs/breadboard/harness";
import type { RemoteMessageWriter } from "@google-labs/breadboard/remote";
import type { IncomingMessage, ServerResponse } from "http";
import type {
  BoardListEntry,
  GetUserStoreResult,
  OperationResult,
  ServerInfo,
} from "./store.js";
import type {
  InlineDataCapabilityPart,
  StoredDataCapabilityPart,
} from "@breadboard-ai/types";

export type GeneralRequestType = "list" | "create" | "options";

export type UserRequestType =
  | "list"
  | "create"
  | "get"
  | "update"
  | "app"
  | "api"
  | "invoke"
  | "describe"
  | "run"
  | "invite-list"
  | "invite-update";

export type RequestType = GeneralRequestType | UserRequestType;

export type GeneralParseResult = {
  success: true;
  type: GeneralRequestType;
};

export type BoardParseResult = {
  success: true;
  type: UserRequestType;
  board: string;
  url: string;
  user: string;
  name: string;
};

export type ParseResult =
  | GeneralParseResult
  | BoardParseResult
  | { success: false; error: string; code: number };

export type ApiHandler = <T extends ParseResult>(
  parsed: T,
  req: IncomingMessage,
  res: ServerResponse,
  body?: unknown
) => Promise<boolean>;

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

export type BoardServerStore = {
  getServerInfo(): Promise<ServerInfo | undefined>;
  createUser(username: string, apiKey: string): Promise<CreateUserResult>;
  list(userKey: string | null): Promise<BoardListEntry[]>;
  getUserStore(userKey: string | null): Promise<GetUserStoreResult>;
  get(userStore: string, boardName: string): Promise<string>;
  update(
    userStore: string,
    path: string,
    graph: GraphDescriptor
  ): Promise<OperationResult>;
  create(
    userKey: string,
    name: string,
    dryRun: boolean
  ): Promise<CreateBoardResult>;
};

export type BlobStore = {
  saveBlob(data: InlineDataCapabilityPart): Promise<BlobStoreSaveResult>;
  getBlob(blobId: string): Promise<BlobStoreGetResult>;
};

export type BlobStoreSaveResult =
  | {
      success: true;
      data: StoredDataCapabilityPart;
    }
  | {
      success: false;
      error: string;
    };

export type BlobStoreGetResult =
  | {
      success: true;
      data: Buffer;
      mimeType?: string;
    }
  | {
      success: false;
      error: string;
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
