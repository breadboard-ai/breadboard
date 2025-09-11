/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@types/gapi.calendar" />

import { BuiltInClient, McpBuiltInClient } from "@breadboard-ai/mcp";
import { TokenGetter } from "@breadboard-ai/types";
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
        return {
          content: [
            {
              type: "text",
              text: "GAPI is not loaded, unable to query Google Calendar",
            },
          ],
          isError: true,
        };
      }
      await new Promise((resolve) => gapi.load("client", resolve));
      const access_token = await tokenGetter();
      if (!ok(access_token)) {
        return {
          content: [{ type: "text", text: access_token.$error }],
          isError: true,
        };
      }
      gapi.client.setToken({ access_token });
      await gapi.client.load(
        "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
      );

      const response = await gapi.client.calendar.events.list({
        calendarId: "primary",
      });
      console.log("RESULT", response.result);

      return {
        content: [{ type: "text", text: `No upcoming events` }],
      };
    }
  );

  return client;
}
