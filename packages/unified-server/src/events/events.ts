/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type * as BreadboardUI from "@breadboard-ai/shared-ui";

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

export class DismissMenuEvent extends Event {
  static eventName = "bbdismissmenu";

  constructor() {
    super(DismissMenuEvent.eventName, { ...eventInit });
  }
}

export class OverlayDismissEvent extends Event {
  static eventName = "bboverlaydismiss";

  constructor() {
    super(OverlayDismissEvent.eventName, { ...eventInit });
  }
}

export class ShareEvent extends Event {
  static eventName = "bbshare";

  constructor() {
    super(ShareEvent.eventName, { ...eventInit });
  }
}

export class SecretsEnterEvent extends Event {
  static eventName = "bbsekrits";

  constructor(public readonly sekrits: Record<string, string>) {
    super(SecretsEnterEvent.eventName, { ...eventInit });
  }
}

export class BoardServerAPIKeyEnterEvent extends Event {
  static eventName = "bbserverkeyenter";

  constructor(public readonly key: string) {
    super(BoardServerAPIKeyEnterEvent.eventName, { ...eventInit });
  }
}

export class BoardServerKeyRequestEvent extends Event {
  static eventName = "bbserverkeyrequest";

  constructor() {
    super(BoardServerKeyRequestEvent.eventName, { ...eventInit });
  }
}

export class RunContextChangeEvent extends Event {
  static eventName = "bbruncontextchange";

  constructor(public readonly where: "remote" | "local") {
    super(RunContextChangeEvent.eventName, { ...eventInit });
  }
}

export class InviteRequestEvent extends Event {
  static eventName = "bbinviterequest";

  constructor() {
    super(InviteRequestEvent.eventName, { ...eventInit });
  }
}

export class ToastEvent extends Event {
  static eventName = "bbtoast";

  constructor(
    public readonly message: string,
    public readonly toastType: BreadboardUI.Events.ToastType
  ) {
    super(ToastEvent.eventName, { ...eventInit });
  }
}
