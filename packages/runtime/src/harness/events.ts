/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  End,
  ErrorResponse,
  GraphEndProbeData,
  GraphStartProbeData,
  HarnessRunResult,
  InputResponse,
  InputValues,
  NodeEndResponse,
  NodeStartResponse,
  OutputResponse,
  RunEndEvent,
  RunErrorEvent,
  RunGraphEndEvent,
  RunGraphStartEvent,
  RunInputEvent,
  RunLifecycleEvent,
  RunNextEvent,
  RunNodeEndEvent,
  RunNodeStartEvent,
  RunOutputEvent,
  RunSecretEvent,
  RunSkipEvent,
  SecretResult,
  SkipProbeMessage,
  TraversalResult,
} from "@breadboard-ai/types";

const opts = {
  composed: true,
  bubbles: false,
  cancelable: true,
};

export class PendingEvent extends Event {
  static readonly eventName = "pending";

  constructor(public data: { timestamp: number }) {
    super(PendingEvent.eventName, { ...opts });
  }
}

export class InputEvent extends Event implements RunInputEvent {
  static readonly eventName = "input";

  constructor(
    public readonly running: boolean,
    public data: InputResponse
  ) {
    super(InputEvent.eventName, { ...opts });
  }
}

export class OutputEvent extends Event implements RunOutputEvent {
  static readonly eventName = "output";
  readonly running = true;

  constructor(public data: OutputResponse) {
    super(OutputEvent.eventName, { ...opts });
  }
}

export class SecretEvent extends Event implements RunSecretEvent {
  static readonly eventName = "secret";

  constructor(
    public readonly running: boolean,
    public data: SecretResult["data"]
  ) {
    super(SecretEvent.eventName, { ...opts });
  }
}

export class RunnerErrorEvent extends Event implements RunErrorEvent {
  static readonly eventName = "error";
  readonly running = false;

  constructor(public data: ErrorResponse) {
    super(RunnerErrorEvent.eventName, { ...opts });
  }
}

export class EndEvent extends Event implements RunEndEvent {
  static readonly eventName = "end";
  readonly running = false;

  constructor(public data: End) {
    super(EndEvent.eventName, { ...opts });
  }
}

export class SkipEvent extends Event implements RunSkipEvent {
  static readonly eventName = "skip";
  readonly running = true;

  constructor(public data: SkipProbeMessage["data"]) {
    super(SkipEvent.eventName, { ...opts });
  }
}

export class GraphStartEvent extends Event implements RunGraphStartEvent {
  static readonly eventName = "graphstart";
  readonly running = true;

  constructor(public data: GraphStartProbeData) {
    super(GraphStartEvent.eventName, { ...opts });
  }
}

export class GraphEndEvent extends Event implements RunGraphEndEvent {
  static readonly eventName = "graphend";
  readonly running = true;

  constructor(public data: GraphEndProbeData) {
    super(GraphEndEvent.eventName, { ...opts });
  }
}

export class NodeStartEvent extends Event implements RunNodeStartEvent {
  static readonly eventName = "nodestart";
  readonly running = true;

  constructor(
    public data: NodeStartResponse,
    public result?: TraversalResult
  ) {
    super(NodeStartEvent.eventName, { ...opts });
  }
}

export class NodeEndEvent extends Event implements RunNodeEndEvent {
  static readonly eventName = "nodeend";
  readonly running = true;

  constructor(public data: NodeEndResponse) {
    super(NodeEndEvent.eventName, { ...opts });
  }
}

export class PauseEvent extends Event implements RunLifecycleEvent {
  static readonly eventName = "pause";

  constructor(
    public running: boolean,
    public data: { timestamp: number }
  ) {
    super(PauseEvent.eventName, { ...opts });
  }
}

export class ResumeEvent extends Event implements RunLifecycleEvent {
  static readonly eventName = "resume";
  readonly running = true;

  constructor(public data: { timestamp: number; inputs?: InputValues }) {
    super(ResumeEvent.eventName, { ...opts });
  }
}

export class StartEvent extends Event implements RunLifecycleEvent {
  static readonly eventName = "start";
  readonly running = true;

  constructor(public data: { timestamp: number; inputs?: InputValues }) {
    super(StartEvent.eventName, { ...opts });
  }
}

export class StopEvent extends Event implements RunLifecycleEvent {
  static readonly eventName = "stop";

  constructor(
    public running: boolean,
    public data: { timestamp: number }
  ) {
    super(StopEvent.eventName, { ...opts });
  }
}

export class NextEvent extends Event implements RunNextEvent {
  static readonly eventName = "next";

  constructor(public data: HarnessRunResult | void) {
    super(NextEvent.eventName, { ...opts });
  }
}
