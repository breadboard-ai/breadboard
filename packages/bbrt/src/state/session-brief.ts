/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";

/**
 * JSON-serializable brief summary data about a session (e.g. what would be
 * needed for a list of sessions; mostly just title and ID).
 */
export interface SessionBriefState {
  id: string;
  title: string;
}

/**
 * Wrapper around {@link SessionBriefState} which provides reactivity
 * via proposed TC39 signals (https://github.com/tc39/proposal-signals).
 */
export class ReactiveSessionBriefState implements SessionBriefState {
  readonly id: string;
  @signal accessor title: string;

  constructor({ id, title }: SessionBriefState) {
    this.id = id;
    this.title = title;
  }

  get data(): SessionBriefState {
    return {
      id: this.id,
      title: this.title,
    };
  }
}
