/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@maxim_mazurok/gapi.client.calendar-v3" />

import { Outcome } from "./data.js";

/**
 * Provides proxy methods for all external APIs used by Opal.
 */
export type ApiProxy = {
  calendarEventsList(
    ...args: Parameters<typeof gapi.client.calendar.events.list>
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Events>>>;
};
