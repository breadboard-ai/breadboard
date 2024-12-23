/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import type { ReactiveAppState } from "./app.js";
import type { ReactiveSessionBriefState } from "./session-brief.js";
import type { ReactiveSessionState } from "./session.js";

export interface Persistence {
  saveApp(app: ReactiveAppState): Promise<Result<void>>;
  loadApp(): Promise<Result<ReactiveAppState | null>>;
  saveSession(session: ReactiveSessionState): Promise<Result<void>>;
  loadSession(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState | null>>;
  deleteSession(sessionId: string): Promise<Result<void>>;
}
