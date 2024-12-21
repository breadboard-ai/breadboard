/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SignalMap } from "signal-utils/map";
import {
  ReactiveSessionBriefState,
  type SessionBriefState,
} from "./session-brief.js";

/**
 * JSON-serializable top-level application state.
 */
export interface AppState {
  sessions: Record<string, SessionBriefState>;
}

/**
 * Wrapper around {@link AppState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveAppState implements AppState {
  readonly sessionMap: SignalMap<string, ReactiveSessionBriefState>;

  constructor({ sessions }: AppState) {
    this.sessionMap = new SignalMap(
      Object.entries(sessions).map(([id, session]) => [
        id,
        new ReactiveSessionBriefState(session),
      ])
    );
  }

  get sessions(): Record<string, ReactiveSessionBriefState> {
    return Object.fromEntries(this.sessionMap);
  }

  get data(): AppState {
    return {
      sessions: Object.fromEntries(
        [...this.sessionMap.entries()].map(([id, session]) => [
          id,
          session.data,
        ])
      ),
    };
  }
}
