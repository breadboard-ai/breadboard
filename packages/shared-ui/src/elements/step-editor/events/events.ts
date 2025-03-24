/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeIdentifier } from "@breadboard-ai/types";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class NodeTranslateEvent extends Event {
  static eventName = "bbnodetranslate" as const;

  constructor(public readonly hasSettled = false) {
    super(NodeTranslateEvent.eventName, { ...eventInit });
  }
}

export class NodeSelectEvent extends Event {
  static eventName = "bbnodeselect" as const;

  constructor(public readonly nodeId: NodeIdentifier) {
    super(NodeSelectEvent.eventName, { ...eventInit });
  }
}

export class NodeBoundsUpdateRequestEvent extends Event {
  static eventName = "bbnodeboundsupdaterequest" as const;

  constructor() {
    super(NodeBoundsUpdateRequestEvent.eventName, { ...eventInit });
  }
}
