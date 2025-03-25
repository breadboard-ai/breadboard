/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class SelectionTranslateEvent extends Event {
  static eventName = "bbselectiontranslate" as const;

  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly hasSettled = false
  ) {
    super(SelectionTranslateEvent.eventName, { ...eventInit });
  }
}

export class NodeBoundsUpdateRequestEvent extends Event {
  static eventName = "bbnodeboundsupdaterequest" as const;

  constructor() {
    super(NodeBoundsUpdateRequestEvent.eventName, { ...eventInit });
  }
}
