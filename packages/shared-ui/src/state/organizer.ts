/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { signal } from "signal-utils";
import { SignalArray } from "signal-utils/array";

export type OrganizerEntry = {
  title: string;
};

export type Organizer = {
  id: string | null;
  entries: OrganizerEntry[];
};

class ReactiveOrganizer implements Organizer {
  readonly entries: SignalArray<OrganizerEntry>;

  @signal
  accessor id: string | null = null;

  constructor() {
    this.entries = new SignalArray();
  }
}
