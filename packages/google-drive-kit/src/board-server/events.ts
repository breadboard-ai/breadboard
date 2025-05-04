/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BoardServerSaveStatusChangeEvent,
  BoardServerSaveEventStatus,
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
