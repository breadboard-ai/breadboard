/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalArray } from "signal-utils/array";
import type { ReactiveSessionBriefState } from "./session-brief.js";
import {
  ReactiveSessionEventState,
  SessionEventState,
} from "./session-event.js";
import type { ReactiveTurnState } from "./turn.js";

/**
 * JSON-serializable complete state of a session.
 */
export interface SessionState {
  // Note that `title` is stored only on `SessionBriefState` to avoid
  // duplication in the data model, but `ReactiveSessionState` exposes
  // forwarding getters/setters for `title` so that only one or the other state
  // object usually needs to be passed around.
  id: string;
  events: SessionEventState[];
}

/**
 * Wrapper around {@link SessionState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveSessionState implements SessionState {
  readonly id: string;
  readonly events: SignalArray<ReactiveSessionEventState>;
  readonly #brief: ReactiveSessionBriefState;

  constructor({ id, events }: SessionState, brief: ReactiveSessionBriefState) {
    if (brief.id !== id) {
      throw new Error(
        `ReactiveSessionState constructor:` +
          ` Session brief ID did not match ours:` +
          ` ${JSON.stringify(brief.id)} (brief) vs ${JSON.stringify(id)} (ours)`
      );
    }
    this.id = id;
    this.#brief = brief;
    this.events = new SignalArray(
      events.map((event) => new ReactiveSessionEventState(event))
    );
  }

  get title() {
    return this.#brief.title;
  }

  set title(title: string) {
    this.#brief.title = title;
  }

  @signal
  get data(): SessionState {
    return {
      id: this.id,
      events: [...this.events].map((event) => event.data),
    };
  }

  @signal
  get turns(): ReadonlyArray<ReactiveTurnState> {
    const result = [];
    for (const event of this.events) {
      if (event.detail.kind === "turn") {
        result.push(event.detail.turn);
      }
    }
    return result;
  }

  @signal
  get driverId() {
    return this.#mostRecentEventOfKind("set-driver")?.driverId;
  }

  @signal
  get systemPrompt() {
    return this.#mostRecentEventOfKind("set-system-prompt")?.systemPrompt;
  }

  @signal
  get activeToolIds(): ReadonlySet<string> {
    return new Set(this.#mostRecentEventOfKind("set-active-tool-ids")?.toolIds);
  }

  @signal
  get activeArtifactId(): string | undefined {
    return this.#mostRecentEventOfKind("set-active-artifact-id")?.artifactId;
  }

  set activeArtifactId(artifactId: string | undefined) {
    const lastEvent = this.events.at(-1);
    if (lastEvent?.detail.kind === "set-active-artifact-id") {
      this.events.pop();
    }
    this.events.push(
      new ReactiveSessionEventState({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        detail: {
          kind: "set-active-artifact-id",
          artifactId,
        },
      })
    );
  }

  set activeToolIds(toolIds: string[]) {
    const lastEvent = this.events.at(-1);
    if (lastEvent?.detail.kind === "set-active-tool-ids") {
      this.events.pop();
    }
    this.events.push(
      new ReactiveSessionEventState({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        detail: {
          kind: "set-active-tool-ids",
          toolIds,
        },
      })
    );
  }

  #mostRecentEventOfKind<K extends ReactiveSessionEventState["detail"]["kind"]>(
    kind: K
  ): Extract<ReactiveSessionEventState["detail"], { kind: K }> | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const { detail } = this.events[i]!;
      if (detail.kind === kind) {
        return detail as Extract<
          ReactiveSessionEventState["detail"],
          { kind: K }
        >;
      }
    }
    return undefined;
  }
}
