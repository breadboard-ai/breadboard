/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EmbedHandler } from "@breadboard-ai/types/embedder.js";
import { type OAuthScope } from "../ui/connection/oauth-scopes.js";
import { type UserSignInResponse } from "../sca/types.js";
import { FileSystemEntry } from "@breadboard-ai/types";
import { OpalShellHostProtocol } from "@breadboard-ai/types/opal-shell-protocol.js";
import type { GlobalConfig } from "../sca/types.js";
import { GuestConfiguration } from "@breadboard-ai/types/opal-shell-protocol.js";
import { SCA } from "../sca/sca.js";

// Re-export types whose canonical definitions live in ui/types/types.ts.
// Consumers that already import from graph-types.ts continue to work.
export type {
  GraphSelectionState,
  ReferenceIdentifier,
  SelectionChangeId,
  MultiGraphSelectionState,
} from "../ui/types/types.js";

export interface RuntimeConfig {
  sca?: Readonly<SCA>;
  globalConfig: GlobalConfig;
  guestConfig: GuestConfiguration;

  shellHost: OpalShellHostProtocol;
  embedHandler?: EmbedHandler;
  env?: FileSystemEntry[];
  appName: string;
  appSubName: string;
  askUserToSignInIfNeeded?: (
    scopes?: OAuthScope[]
  ) => Promise<UserSignInResponse>;
}

export type EditChangeId = ReturnType<typeof crypto.randomUUID>;
export type MoveToSelection = "immediate" | "animated" | false;

export type VisualEditorMode = "app" | "canvas";

export type Control<T> = T | { $control: string };
