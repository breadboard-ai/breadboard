/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalMap } from "signal-utils/map";
import {
  ReactiveSessionBriefState,
  type SessionBriefState,
} from "./session-brief.js";

/**
 * JSON-serializable top-level application state.
 */
export interface AppState {
  activeSessionId: string | null;
  sessions: Record<string, SessionBriefState>;
}

/**
 * Wrapper around {@link AppState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveAppState implements AppState {
  @signal
  accessor activeSessionId: string | null;
  readonly sessionMap: SignalMap<string, ReactiveSessionBriefState>;

  constructor({ activeSessionId, sessions }: AppState) {
    this.activeSessionId = activeSessionId;
    this.sessionMap = new SignalMap(
      Object.entries(sessions).map(([id, session]) => [
        id,
        new ReactiveSessionBriefState(session),
      ])
    );
  }

  get sessions(): Readonly<Record<string, ReactiveSessionBriefState>> {
    return Object.fromEntries(this.sessionMap);
  }

  get activeSession(): ReactiveSessionBriefState | undefined {
    if (this.activeSessionId === null) {
      return undefined;
    }
    return this.sessionMap.get(this.activeSessionId);
  }

  get data(): AppState {
    return {
      activeSessionId: this.activeSessionId,
      sessions: Object.fromEntries(
        [...this.sessionMap.entries()].map(([id, session]) => [
          id,
          session.data,
        ])
      ),
    };
  }

  createSessionBrief(title?: string): ReactiveSessionBriefState {
    const brief = new ReactiveSessionBriefState({
      id: crypto.randomUUID(),
      title: title ?? "Untitled Session",
    });
    this.sessionMap.set(brief.id, brief);
    return brief;
  }
}
