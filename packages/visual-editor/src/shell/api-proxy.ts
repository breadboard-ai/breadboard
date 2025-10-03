/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TokenGetter } from "@breadboard-ai/mcp";
import { ApiProxy, Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { createApiProxy };

function createApiProxy(tokenGetter: TokenGetter): ApiProxy {
  return {
    async calendarEventsList(request) {
      const calendar = await loadCalendarApi(tokenGetter);
      if (!ok(calendar)) return calendar;
      return calendar.events.list(request);
    },
  };
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
