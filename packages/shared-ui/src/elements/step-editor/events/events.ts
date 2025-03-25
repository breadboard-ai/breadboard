/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphIdentifier } from "@breadboard-ai/types";

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

export class SelectGraphContentsEvent extends Event {
  static eventName = "bbselectgraphcontents" as const;

  constructor(public readonly graphId: GraphIdentifier) {
    super(SelectGraphContentsEvent.eventName, { ...eventInit });
  }
}

export class NodeBoundsUpdateRequestEvent extends Event {
  static eventName = "bbnodeboundsupdaterequest" as const;

  constructor() {
    super(NodeBoundsUpdateRequestEvent.eventName, { ...eventInit });
  }
}
