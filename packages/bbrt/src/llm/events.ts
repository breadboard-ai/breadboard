/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactiveTurnState } from "../state/turn.js";

export class ForkEvent extends Event {
  readonly turn: ReactiveTurnState;

  constructor(turn: ReactiveTurnState) {
    super("bbrt-fork", { bubbles: true, composed: true });
    this.turn = turn;
  }
}

export class RetryEvent extends Event {
  readonly turn: ReactiveTurnState;

  constructor(turn: ReactiveTurnState) {
    super("bbrt-retry", { bubbles: true, composed: true });
    this.turn = turn;
  }
}

export class CutEvent extends Event {
  readonly turn: ReactiveTurnState;

  constructor(turn: ReactiveTurnState) {
    super("bbrt-cut", { bubbles: true, composed: true });
    this.turn = turn;
  }
}

export class EditEvent extends Event {
  readonly turn: ReactiveTurnState;

  constructor(turn: ReactiveTurnState) {
    super("bbrt-edit", { bubbles: true, composed: true });
    this.turn = turn;
  }
}

declare global {
  interface WindowEventMap {
    "bbrt-fork": ForkEvent;
    "bbrt-retry": RetryEvent;
    "bbrt-cut": CutEvent;
    "bbrt-edit": EditEvent;
  }
}
