/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Result } from "../util/result.js";
import type { ReactiveSessionBriefState } from "./session-brief.js";
import type { SessionPersister } from "./session-persistence.js";
import { ReactiveSessionState } from "./session.js";

export interface SessionStoreOptions {
  defaults: {
    systemPrompt: string;
    driverId: string;
    activeToolIds: string[];
  };
  persistence: SessionPersister;
}

export class SessionStore {
  readonly #defaults: SessionStoreOptions["defaults"];
  readonly #persistence: SessionPersister;

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
    const saveResult = await this.#persistence.save(session);
    if (!saveResult.ok) {
      return saveResult;
    }
    return { ok: true, value: session };
  }

  loadSession(
    brief: ReactiveSessionBriefState
  ): Promise<Result<ReactiveSessionState | null>> {
    return this.#persistence.load(brief);
  }
}
