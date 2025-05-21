/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BoardServerSaveStatusChangeEvent,
  BoardServerSaveEventStatus,
  BoardServerListRefreshed,
} from "@google-labs/breadboard";

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class SaveEvent
  extends Event
  implements BoardServerSaveStatusChangeEvent
{
  static eventName = "savestatuschange";
  constructor(
    public readonly status: BoardServerSaveEventStatus,
    public readonly url: string
  ) {
    super(SaveEvent.eventName, { ...eventInit });
  }
}

export class RefreshEvent extends Event implements BoardServerListRefreshed {
  static eventName = "boardlistrefreshed";

  constructor() {
    super(RefreshEvent.eventName, eventInit);
  }
}
