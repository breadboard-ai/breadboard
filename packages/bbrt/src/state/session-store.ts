/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import type { Persistence } from "./persistence.js";
import type { ReactiveSessionBriefState } from "./session-brief.js";
import { ReactiveSessionState } from "./session.js";

export interface SessionStoreOptions {
  defaults: {
    systemPrompt: string;
    driverId: string;
    activeToolIds: string[];
  };
  persistence: Persistence;
}

export class SessionStore {
  readonly #defaults: SessionStoreOptions["defaults"];
  readonly #persistence: Persistence;

  constructor({ defaults, persistence }: SessionStoreOptions) {
    this.#defaults = defaults;
    this.#persistence = persistence;
  }

  async createSession(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState>> {
    const session = new ReactiveSessionState(
      { id: brief.id, events: [] },
      brief
    );
    session.driverId = this.#defaults.driverId;
    session.systemPrompt = this.#defaults.systemPrompt;
    session.activeToolIds = this.#defaults.activeToolIds;
    const saveResult = await this.#persistence.saveSession(session);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, value: session };
  }

  loadSession(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState | null>> {
    return this.#persistence.loadSession(brief);
  }

  deleteSession(id: string): Promise<Result<void>> {
    return this.#persistence.deleteSession(id);
  }
}
