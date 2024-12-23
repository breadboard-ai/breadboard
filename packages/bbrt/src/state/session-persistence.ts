/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import type { ReactiveSessionBriefState } from "./session-brief.js";
import { ReactiveSessionState } from "./session.js";

export interface SessionPersister {
  save(session: ReactiveSessionState): Promise<Result<void>>;
  load(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState | null>>;
}

function sessionLocalStorageKey(sessionId: string): string {
  return `bbrt-v3/sessions/${sessionId}`;
}

export class LocalStorageSessionPersister implements SessionPersister {
  async save(session: ReactiveSessionState): Promise<Result<void>> {
    const key = sessionLocalStorageKey(session.id);
    return resultify(() =>
      // throws if the data is too large
      localStorage.setItem(key, JSON.stringify(session.data))
    );
  }

  async load(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState | null>> {
    const data = resultify(() =>
      localStorage.getItem(sessionLocalStorageKey(brief.id))
    );
    if (!data.ok) {
      return data;
    }
    const value = data.value;
    if (!value) {
      return { ok: true, value: null };
    }
    const parsed = resultify(() => JSON.parse(value));
    if (!parsed.ok) {
      return parsed;
    }
    return {
      ok: true,
      value: new ReactiveSessionState(parsed.value, brief),
    };
  }
}
