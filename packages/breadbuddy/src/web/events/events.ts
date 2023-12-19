/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export class WizardCompleteEvent extends Event {
  static eventName = "breadbuddywizardcomplete";

  constructor(public configuration: Record<string, unknown>) {
    super(WizardCompleteEvent.eventName, {
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }
}
