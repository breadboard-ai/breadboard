/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import { resultify } from "../util/resultify.js";
import { type AppState, ReactiveAppState } from "./app.js";
import type { Persistence } from "./persistence.js";
import type { ReactiveSessionBriefState } from "./session-brief.js";
import { ReactiveSessionState } from "./session.js";

const APP_KEY = "bbrt-v3/app";

function sessionKey(sessionId: string): string {
  return `bbrt-v3/sessions/${sessionId}`;
}

export class LocalStoragePersistence implements Persistence {
  async saveApp(app: ReactiveAppState): Promise<Result<void>> {
    return resultify(() =>
      // throws if the data is too large
      localStorage.setItem(APP_KEY, JSON.stringify(app.data))
    );
  }

  async loadApp(): Promise<Result<ReactiveAppState | null>> {
    const data = resultify(() => localStorage.getItem(APP_KEY));
    if (!data.ok) {
      return data;
    }
    const value = data.value;
    if (!value) {
      return { ok: true, value: null };
    }
    const parsed = resultify(() => JSON.parse(value) as AppState);
    if (!parsed.ok) {
      return parsed;
    }
    return {
      ok: true,
      value: new ReactiveAppState(parsed.value),
    };
  }

  async saveSession(session: ReactiveSessionState): Promise<Result<void>> {
    const key = sessionKey(session.id);
    return resultify(() =>
      // throws if the data is too large
      localStorage.setItem(key, JSON.stringify(session.data))
    );
  }

  async loadSession(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState | null>> {
    const data = resultify(() => localStorage.getItem(sessionKey(brief.id)));
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

  async deleteSession(sessionId: string): Promise<Result<void>> {
    localStorage.removeItem(sessionKey(sessionId));
    return { ok: true, value: undefined };
  }
}
