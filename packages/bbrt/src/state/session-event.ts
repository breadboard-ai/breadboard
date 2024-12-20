/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactiveTurnState, type TurnState } from "./turn.js";

/**
 * JSON-serializable data for a session event, which is anything that can happen
 * in a session, including user input, model responses, and configuration
 * changes.
 */
export interface SessionEventState {
  id: string;
  /** Unix milliseconds */
  timestamp: number;
  detail:
    | SessionEventTurn
    | SessionEventSetDriver
    | SessionEventSetSystemPrompt
    | SessionEventSetActiveToolIds
    | SessionEventSetActiveArtifactId;
}

/**
 * Wrapper around {@link SessionEventState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveSessionEventState implements SessionEventState {
  readonly id: string;
  readonly timestamp: number;
  readonly detail:
    | ReactiveSessionEventTurn
    | SessionEventSetDriver
    | SessionEventSetSystemPrompt
    | SessionEventSetActiveToolIds
    | SessionEventSetActiveArtifactId;

  constructor({ id, timestamp, detail }: SessionEventState) {
    this.id = id;
    this.timestamp = timestamp;
    this.detail =
      detail.kind === "turn"
        ? (this.detail = {
            kind: "turn",
            turn: new ReactiveTurnState(detail.turn),
          })
        : detail;
  }

  get data(): SessionEventState {
    return {
      id: this.id,
      timestamp: this.timestamp,
      detail:
        this.detail.kind === "turn"
          ? {
              kind: "turn",
              turn: this.detail.turn.data,
            }
          : this.detail,
    };
  }
}

export interface SessionEventTurn {
  kind: "turn";
  turn: TurnState;
}

export interface ReactiveSessionEventTurn {
  kind: "turn";
  turn: ReactiveTurnState;
}

export interface SessionEventSetDriver {
  kind: "set-driver";
  driverId: string;
}

export interface SessionEventSetSystemPrompt {
  kind: "set-system-prompt";
  systemPrompt: string;
}

export interface SessionEventSetActiveToolIds {
  kind: "set-active-tool-ids";
  toolIds: string[];
}

export interface SessionEventSetActiveArtifactId {
  kind: "set-active-artifact-id";
  artifactId: string | undefined;
}
