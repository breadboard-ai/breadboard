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

/**
 * Sign In and Out
 */

export class SignInEvent extends Event {
  static eventName = "bbsignin";

  constructor() {
    super(SignInEvent.eventName, { ...eventInit });
  }
}

export class SignOutEvent extends Event {
  static eventName = "bbsignout";

  constructor() {
    super(SignOutEvent.eventName, { ...eventInit });
  }
}
