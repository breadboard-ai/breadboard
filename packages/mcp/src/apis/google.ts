/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@maxim_mazurok/gapi.client.calendar-v3" />
/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@maxim_mazurok/gapi.client.gmail-v1" />

import { Outcome } from "@breadboard-ai/types";
import { err, ok, filterUndefined } from "@breadboard-ai/utils";
import { McpBuiltInClientFactoryContext, TokenGetter } from "../types.js";
import { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";

export { GoogleApis };

const CALENDAR_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

const DRIVE_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/drive.readonly",
];

class GoogleApis {
  constructor(private readonly context: McpBuiltInClientFactoryContext) {}

  async #call<Res>(
    url: string,
    method: string,
    scopes: OAuthScope[],
    body?: unknown
  ): Promise<Outcome<gapi.client.Response<Res>>> {
    const token = await this.context.tokenGetter(scopes);

    const maybeBody =
      method !== "GET" && body ? { body: JSON.stringify(body) } : {};

    try {
      const response = await this.context.fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        ...maybeBody,
      });

      if (!response.ok) {
        return err(response.statusText);
      }

      const result = await response.json();
      return {
        result,
        body: "", // will always be empty, since we don't use it.
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      };
    } catch (e) {
      return err((e as Error).message);
    }
  }

  async calendarListEvents(
    request: NonNullable<Parameters<typeof gapi.client.calendar.events.list>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Events>>> {
    const { calendarId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params) as Record<string, string>
    ).toString();

    return this.#call(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${query}`,
      "GET",
      CALENDAR_SCOPES
    );
  }

  async calendarInsertEvent(
    request: NonNullable<
      Parameters<typeof gapi.client.calendar.events.insert>[0]
    >,
    body: gapi.client.calendar.Event
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Event>>> {
    const { calendarId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params) as Record<string, string>
    ).toString();

    return this.#call(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${query}`,
      "POST",
      CALENDAR_SCOPES,
      body
    );
  }

  async calendarUpdateEvent(
    request: NonNullable<
      Parameters<typeof gapi.client.calendar.events.update>[0]
    >,
    body: gapi.client.calendar.Event
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Event>>> {
    const { calendarId, eventId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params as unknown as Record<string, string>)
    ).toString();

    return this.#call(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?${query}`,
      "PUT",
      CALENDAR_SCOPES,
      body
    );
  }

  async calendarDeleteEvent(
    request: NonNullable<
      Parameters<typeof gapi.client.calendar.events.delete>[0]
    >
  ): Promise<Outcome<gapi.client.Response<void>>> {
    const { calendarId, eventId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params as unknown as Record<string, string>)
    ).toString();

    return this.#call(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}?${query}`,
      "DELETE",
      CALENDAR_SCOPES
    );
  }

  async driveListFiles(
    request: NonNullable<Parameters<typeof gapi.client.drive.files.list>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.drive.FileList>>> {
    const query = new URLSearchParams(
      filterUndefined(request as Record<string, string>)
    ).toString();

    return this.#call(
      `https://www.googleapis.com/drive/v3/files?${query}`,
      "GET",
      DRIVE_SCOPES
    );
  }

  async driveGetFile(
    request: NonNullable<Parameters<typeof gapi.client.drive.files.get>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.drive.File>>> {
    const { fileId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params as Record<string, string>)
    ).toString();

    return this.#call(
      `https://www.googleapis.com/drive/v3/files/${fileId}?${query}`,
      "GET",
      DRIVE_SCOPES
    );
  }

  async gmailGetMessages(
    request: NonNullable<
      Parameters<typeof gapi.client.gmail.users.messages.list>[0]
    >
  ): Promise<Outcome<gapi.client.gmail.Message[]>> {
    const gmail = await loadGmailApi(this.context.tokenGetter);
    if (!ok(gmail)) return gmail;

    const listing = await gmail.users.messages.list(request);
    if (listing.status !== 200) {
      return err(listing.statusText || "Unable to list GMail messages.");
    }

    const batch = gapi.client.newBatch();
    const items = listing.result.messages;
    if (!items) {
      return [];
    }
    for (const message of items) {
      batch.add(
        gmail.users.messages.get({
          id: message.id!,
          userId: "me",
        })
      );
    }

    const getting = await batch;
    if (getting.status !== 200) {
      return err(getting.statusText || "Unable to get GMail messages");
    }
    return Object.values(getting.result).map((res) =>
      trimMessage(res.result as gapi.client.gmail.Message)
    );
  }

  async gmailGetThreads(
    request: NonNullable<
      Parameters<typeof gapi.client.gmail.users.threads.list>[0]
    >
  ): Promise<Outcome<gapi.client.gmail.Thread[]>> {
    const gmail = await loadGmailApi(this.context.tokenGetter);
    if (!ok(gmail)) return gmail;

    const listing = await gmail.users.threads.list(request);
    if (listing.status !== 200) {
      return err(listing.statusText || "Unable to list GMail messages.");
    }

    const batch = gapi.client.newBatch();
    const items = listing.result.threads;
    if (!items) {
      return [];
    }
    for (const thread of items) {
      batch.add(
        gmail.users.threads.get({
          id: thread.id!,
          userId: "me",
        })
      );
    }

    const getting = await batch;
    if (getting.status !== 200) {
      return err(getting.statusText || "Unable to get GMail messages");
    }
    return Object.values(getting.result).map((res) => {
      const result = res.result as gapi.client.gmail.Thread;
      result.messages?.forEach((message) => trimMessage(message));
      return result;
    });
  }

  async gmailSendMessage(
    request: NonNullable<
      Parameters<typeof gapi.client.gmail.users.messages.send>
    >[0],
    body: gapi.client.gmail.Message
  ): Promise<Outcome<gapi.client.Response<gapi.client.gmail.Message>>> {
    const gmail = await loadGmailApi(this.context.tokenGetter);
    if (!ok(gmail)) return gmail;

    return gmail.users.messages.send(request, body);
  }

  async gmailCreateDraft(
    request: Parameters<typeof gapi.client.gmail.users.drafts.create>[0],
    body: gapi.client.gmail.Draft
  ): Promise<Outcome<gapi.client.Response<gapi.client.gmail.Draft>>> {
    const gmail = await loadGmailApi(this.context.tokenGetter);
    if (!ok(gmail)) return gmail;

    return gmail.users.drafts.create(request, body);
  }
}

async function loadGmailApi(
  tokenGetter: TokenGetter
): Promise<Outcome<typeof gapi.client.gmail>> {
  if (!globalThis.gapi) {
    return err("GAPI is not loaded, unable to query Google Mail");
  }
  if (!gapi.client) {
    await new Promise((resolve) => gapi.load("client", resolve));
  }
  const access_token = await tokenGetter([
    "https://www.googleapis.com/auth/gmail.modify",
  ]);
  if (!ok(access_token)) {
    return err(access_token.$error);
  }
  gapi.client.setToken({ access_token });
  if (!gapi.client.gmail) {
    await gapi.client.load(
      "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"
    );
  }
  return gapi.client.gmail;
}

function trimMessage(message: gapi.client.gmail.Message) {
  delete message.historyId;
  delete message.payload;
  delete message.sizeEstimate;
  delete message.raw;
  return message;
}
