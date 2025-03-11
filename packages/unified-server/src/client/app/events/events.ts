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

export class InputEnterEvent extends Event {
  static eventName = "bbinputenter";

  constructor(
    public readonly id: string,
    public readonly data: Record<string, unknown>,
    public readonly allowSavingIfSecret: boolean
  ) {
    super(InputEnterEvent.eventName, { ...eventInit });
  }
}

/**
 * Sign In and Out
 */

export class SignInEvent extends Event {
  static eventName = "bbsignin";

  constructor() {
    super(SignInEvent.eventName, { ...eventInit });
  }
}

export class SignInRequestedEvent extends Event {
  static eventName = "bbsigninrequested";

  constructor() {
    super(SignInRequestedEvent.eventName, { ...eventInit });
  }
}

export class SignOutEvent extends Event {
  static eventName = "bbsignout";

  constructor() {
    super(SignOutEvent.eventName, { ...eventInit });
  }
}
