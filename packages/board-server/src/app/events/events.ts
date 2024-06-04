/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

const eventInit = {
  bubbles: true,
  cancelable: true,
  composed: true,
};

export class DownloadRunEvent extends Event {
  static eventName = "bbdownload";

  constructor() {
    super(DownloadRunEvent.eventName, { ...eventInit });
  }
}
