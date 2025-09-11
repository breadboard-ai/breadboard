/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@types/gapi.calendar" />

import {
  BuiltInClient,
  McpBuiltInClient,
  mcpErr,
  mcpText,
  TokenGetter,
} from "@breadboard-ai/mcp";
import { ok } from "@breadboard-ai/utils";

export { createGoogleCalendarClient };

function createGoogleCalendarClient(
  tokenGetter: TokenGetter
): McpBuiltInClient {
  const client = new BuiltInClient({
    name: "Google Calendar",
    url: "builtin:gcal",
  });
  client.addTool(
    "upcoming_events",
    {
      title: "Get Upcoming Events",
      description:
        "Returns the list of upcoming events for the next seven days",
    },
    async () => {
      if (!globalThis.gapi) {
        return mcpErr("GAPI is not loaded, unable to query Google Calendar");
      }
      await new Promise((resolve) => gapi.load("client", resolve));
      const access_token = await tokenGetter([
        "https://www.googleapis.com/auth/calendar.readonly",
      ]);
      if (!ok(access_token)) {
        return mcpErr(access_token.$error);
      }
      gapi.client.setToken({ access_token });
      await gapi.client.load(
        "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
      );

      const response = await gapi.client.calendar.events.list({
        calendarId: "primary",
        timeMin: new Date().toISOString(),
      });
      const events = response?.result?.items;
      if (!events) {
        return mcpErr("Invalid response from the calendar");
      }

      return mcpText(JSON.stringify(events));
    }
  );

  return client;
}
