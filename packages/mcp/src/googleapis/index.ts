/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import "gapi.client.calendar-v3";

import { Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";
import { McpBuiltInClientFactoryContext, TokenGetter } from "../types.js";

export { GoogleApis };

class GoogleApis {
  constructor(private readonly context: McpBuiltInClientFactoryContext) {}

  async calendarListEvents(
    ...args: Parameters<typeof gapi.client.calendar.events.list>
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Events>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;

    return calendar.events.list(...args);
  }

  async calendarInsertEvent(
    ...args: Parameters<typeof gapi.client.calendar.events.insert>
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Event>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;
    return calendar.events.insert(...args);
  }

  async calendarUpdateEvent(
    ...args: Parameters<typeof gapi.client.calendar.events.update>
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Event>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;
    return calendar.events.update(...args);
  }

  async calendarDeleteEvent(
    ...args: Parameters<typeof gapi.client.calendar.events.delete>
  ): Promise<Outcome<gapi.client.Response<void>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;

    return calendar.events.delete(...args);
  }
}

async function loadCalendarApi(
  tokenGetter: TokenGetter
): Promise<Outcome<typeof gapi.client.calendar>> {
  if (!globalThis.gapi) {
    return err("GAPI is not loaded, unable to query Google Calendar");
  }
  if (!gapi.client) {
    await new Promise((resolve) => gapi.load("client", resolve));
  }
  const access_token = await tokenGetter([
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.owned",
  ]);
  if (!ok(access_token)) {
    return err(access_token.$error);
  }
  gapi.client.setToken({ access_token });
  if (!gapi.client.calendar) {
    await gapi.client.load(
      "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
    );
  }
  return gapi.client.calendar;
}
