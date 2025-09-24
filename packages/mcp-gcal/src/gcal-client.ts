/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@maxim_mazurok/gapi.client.calendar-v3" />

import {
  BuiltInClient,
  McpBuiltInClient,
  mcpErr,
  mcpText,
  TokenGetter,
} from "@breadboard-ai/mcp";
import { Outcome } from "@breadboard-ai/types";
import { err, filterUndefined, ok } from "@breadboard-ai/utils";
import { z } from "zod";

export { createGoogleCalendarClient };

function createGoogleCalendarClient(
  tokenGetter: TokenGetter
): McpBuiltInClient {
  const client = new BuiltInClient({
    name: "Google Calendar",
    url: "builtin:gcal",
  });
  client.addTool(
    "gcal_list_events",
    {
      title: "List events",
      description:
        "Get a list of Google Calendar events in the user's primary calendar based on specified parameters",
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
      inputSchema: {
        eventTypes: z
          .string()
          .describe(
            `Event types to return. Optional. This parameter can be repeated multiple times to return events of different types. If unset, returns all event types.

Acceptable values are:
"birthday": Special all-day events with an annual recurrence.
"default": Regular events.
"focusTime": Focus time events.
"fromGmail": Events from Gmail.
"outOfOffice": Out of office events.
"workingLocation": Working location events.`
          )
          .optional(),
        maxResults: z
          .number()
          .describe(
            `Maximum number of events returned on one result page. The number of events in the resulting page may be less than this value, or none at all, even if there are more events matching the query. Incomplete pages can be detected by a non-empty nextPageToken field in the response. By default the value is 250 events. The page size can never be larger than 2500 events. Optional.`
          )
          .optional(),
        q: z
          .string()
          .describe(
            `Free text search terms to find events that match these terms in the following fields:
- summary
- description
- location
- attendee's displayName
- attendee's email
- organizer's displayName
- organizer's email
- workingLocationProperties.officeLocation.buildingId
- workingLocationProperties.officeLocation.deskId
- workingLocationProperties.officeLocation.label
- workingLocationProperties.customLocation.label

These search terms also match predefined keywords against all display title translations of working location, out-of-office, and focus-time events. For example, searching for "Office" or "Bureau" returns working location events of type officeLocation, whereas searching for "Out of office" or "Abwesend" returns out-of-office events. Optional.`
          )
          .optional(),
        showDeleted: z
          .boolean()
          .describe(
            `Whether to include deleted events (with status equals "cancelled") in the result. Cancelled instances of recurring events (but not the underlying recurring event) will still be included if showDeleted and singleEvents are both False. If showDeleted and singleEvents are both True, only single instances of deleted events (but not the underlying recurring events) are returned. Optional. The default is False.`
          )
          .optional(),
        showHidden: z
          .boolean()
          .describe(
            `Whether to include hidden invitations in the result. Optional. The default is False.`
          )
          .optional(),
        single: z
          .boolean()
          .describe(
            `Whether to expand recurring events into instances and only return single one-off events and instances of recurring events, but not the underlying recurring events themselves. Optional. The default is False.`
          )
          .optional(),
        timeMax: z
          .string()
          .describe(
            `Upper bound (exclusive) for an event's start time to filter by. Optional. The default is not to filter by start time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMin is set, timeMax must be greater than timeMin.`
          )
          .optional(),
        timeMin: z
          .string()
          .describe(
            `Lower bound (exclusive) for an event's end time to filter by. Optional. The default is not to filter by end time. Must be an RFC3339 timestamp with mandatory time zone offset, for example, 2011-06-03T10:00:00-07:00, 2011-06-03T10:00:00Z. Milliseconds may be provided but are ignored. If timeMax is set, timeMin must be smaller than timeMax.`
          )
          .optional(),
        updatedMin: z
          .string()
          .describe(
            `Lower bound for an event's last modification time (as a RFC3339 timestamp) to filter by. When specified, entries deleted since this time will always be included regardless of showDeleted. Optional. The default is not to filter by last modification time.`
          )
          .optional(),
      },
    },
    async ({
      maxResults,
      q,
      showDeleted,
      showHidden,
      single,
      timeMin,
      timeMax,
      updatedMin,
    }) => {
      const calendar = await loadCalendarApi(tokenGetter);
      if (!ok(calendar)) {
        return mcpErr(calendar.$error);
      }
      const listing = await calendar.events.list(
        filterUndefined({
          calendarId: "primary",
          timeMin,
          maxResults,
          q,
          showDeleted,
          showHidden,
          single,
          timeMax,
          updatedMin,
        })
      );
      if (listing.status !== 200) {
        return mcpErr(
          `Failed to list Google Calendar events: ${listing.statusText!}`
        );
      }

      const events = listing.result?.items;
      if (!events) {
        return mcpErr("Invalid response from the calendar");
      }

      return mcpText(JSON.stringify(events));
    }
  );

  const eventSchema = {
    summary: z.string().describe(`The title of the event`),
    end: z
      .string()
      .describe(
        `The (exclusive) end time of the event. For a recurring event, this is the end time of the first instance. Value must be a combined date-time value (formatted according to RFC3339).`
      ),
    start: z
      .string()
      .describe(
        `The (inclusive) start time of the event. For a recurring event, this is the start time of the first instance.Value must be a combined date-time value (formatted according to RFC3339).`
      ),
    status: z.string()
      .describe(`Status of the event. Optional. Possible values are:
- "confirmed" - The event is confirmed. This is the default status.
- "tentative" - The event is tentatively confirmed.
- "cancelled" - The event is cancelled (deleted).`),
    visibility: z
      .string()
      .describe(
        `Visibility of the event. Optional. Possible values are:
- "default" - Uses the default visibility for events on the calendar. This is the default value.
- "public" - The event is public and event details are visible to all readers of the calendar.
- "private" - The event is private and only event attendees may view event details.
- "confidential" - The event is private. This value is provided for compatibility reasons.`
      )
      .optional(),
    guestsCanModify: z
      .boolean()
      .describe(
        `Whether attendees other than the organizer can invite others to the event. Optional. The default is True.`
      )
      .optional(),
    attendees: z
      .array(
        z.object({
          email: z
            .string()
            .describe(
              `The attendee's email address, if available. This field must be present when adding an attendee. It must be a valid email address as per RFC5322.`
            ),
          optional: z
            .string()
            .describe(
              `Whether this is an optional attendee. Optional. The default is False.`
            )
            .optional(),
        })
      )
      .describe(`The attendees of the event.`),
    googleMeet: z
      .boolean()
      .describe(
        `Whether or not to add a Google Meet link to the event. Optional, the default is False`
      )
      .optional(),
    description: z
      .string()
      .describe(`Description of the event. Can contain HTML. Optional.`)
      .optional(),
  };

  client.addTool(
    "gcal_create_event",
    {
      title: "Create event",
      description:
        "Creates a Google Calendar event in the user's primary calendar.",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: eventSchema,
    },
    async ({
      summary,
      start,
      end,
      status,
      visibility,
      attendees,
      googleMeet,
      description,
      guestsCanModify,
    }) => {
      type Event = gapi.client.calendar.Event;

      const calendar = await loadCalendarApi(tokenGetter);
      if (!ok(calendar)) {
        return mcpErr(calendar.$error);
      }

      const conferenceData = googleMeet
        ? ({
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: {
                  type: "hangoutsMeet",
                },
              },
            },
          } satisfies Event)
        : {};

      const inserting = await calendar.events.insert(
        { calendarId: "primary", conferenceDataVersion: 1 },
        {
          summary,
          end: {
            dateTime: end,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          start: {
            dateTime: start,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          visibility: visibility as Event["visibility"],
          status: status as Event["status"],
          attendees: attendees as Event["attendees"],
          description,
          guestsCanModify,
          ...conferenceData,
        }
      );
      if (inserting.status !== 200) {
        return mcpErr(
          inserting.statusText || "Failed to add Google Calendar event"
        );
      }

      return mcpText("Success");
    }
  );

  client.addTool(
    "gcal_update_event",
    {
      title: "Update event",
      description:
        "Makes an update to a Google Calendar event on user's primary calendar",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        eventId: z.string().describe("Event identifier"),
        ...eventSchema,
      },
    },
    async ({
      eventId,
      summary,
      start,
      end,
      status,
      visibility,
      attendees,
      googleMeet,
      description,
      guestsCanModify,
    }) => {
      type Event = gapi.client.calendar.Event;

      const calendar = await loadCalendarApi(tokenGetter);
      if (!ok(calendar)) {
        return mcpErr(calendar.$error);
      }
      const conferenceData = googleMeet
        ? ({
            conferenceData: {
              createRequest: {
                requestId: crypto.randomUUID(),
                conferenceSolutionKey: {
                  type: "hangoutsMeet",
                },
              },
            },
          } satisfies Event)
        : {};
      const updating = await calendar.events.update(
        {
          eventId,
          calendarId: "primary",
          conferenceDataVersion: 1,
        },
        filterUndefined({
          summary,
          end: {
            dateTime: end,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          start: {
            dateTime: start,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          visibility: visibility as Event["visibility"],
          status: status as Event["status"],
          attendees: attendees as Event["attendees"],
          description,
          guestsCanModify,
          ...conferenceData,
        })
      );

      if (updating.status !== 200) {
        return mcpErr(
          updating.statusText || "Failed to update Google Calendar event"
        );
      }

      return mcpText("Success");
    }
  );

  client.addTool(
    "gcal_delete_event",
    {
      title: "Delete event",
      description:
        "Deletes specified Google Calendar event from the user's primary calendar",
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
      inputSchema: {
        eventId: z.string().describe("Event identifier"),
      },
    },
    async ({ eventId }) => {
      const calendar = await loadCalendarApi(tokenGetter);
      if (!ok(calendar)) {
        return mcpErr(calendar.$error);
      }

      const deleting = await calendar.events.delete({
        calendarId: "primary",
        eventId,
      });
      if (deleting.status !== 204) {
        return mcpErr(
          deleting.statusText || "Unable to delete Google Calendar event"
        );
      }

      return mcpText("Success");
    }
  );

  return client;
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
