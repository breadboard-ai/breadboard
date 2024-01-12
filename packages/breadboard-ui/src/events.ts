/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class StartEvent extends Event {
  static eventName = "breadboardstart";

  constructor(public url: string) {
    super(StartEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export const enum ToastType {
  INFORMATION = "information",
  WARNING = "warning",
  ERROR = "error",
}

export class ToastEvent extends Event {
  static eventName = "breadboardtoast";

  constructor(public message: string, public toastType: ToastType) {
    super(ToastEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class DelayEvent extends Event {
  static eventName = "breadboarddelay";

  constructor(public duration: number) {
    super(DelayEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class NodeSelectEvent extends Event {
  static eventName = "breadboardnodeselect";

  constructor(public id: string) {
    super(NodeSelectEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class InputEnterEvent extends Event {
  static eventName = "breadboardinputenter";

  constructor(public id: string, public data: Record<string, unknown>) {
    super(InputEnterEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class BoardUnloadEvent extends Event {
  static eventName = "breadboardboardunload";

  constructor() {
    super(BoardUnloadEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class MessageTraversalEvent extends Event {
  static eventName = "breadboardmessagetraversal";

  constructor(public index: number) {
    super(MessageTraversalEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}

export class ResumeEvent extends Event {
  static eventName = "breadboardresume";

  constructor() {
    super(ResumeEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}
