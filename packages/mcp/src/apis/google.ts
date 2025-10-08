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

export { GoogleApis };

class GoogleApis {
  constructor(private readonly context: McpBuiltInClientFactoryContext) {}

  async calendarListEvents(
    request: NonNullable<Parameters<typeof gapi.client.calendar.events.list>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Events>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;

    return calendar.events.list(filterUndefined(request));
  }

  async calendarInsertEvent(
    request: NonNullable<
      Parameters<typeof gapi.client.calendar.events.insert>[0]
    >,
    body: gapi.client.calendar.Event
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Event>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;
    return calendar.events.insert(request, body);
  }

  async calendarUpdateEvent(
    request: NonNullable<
      Parameters<typeof gapi.client.calendar.events.update>[0]
    >,
    body: gapi.client.calendar.Event
  ): Promise<Outcome<gapi.client.Response<gapi.client.calendar.Event>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;
    return calendar.events.update(filterUndefined(request), body);
  }

  async calendarDeleteEvent(
    request: NonNullable<
      Parameters<typeof gapi.client.calendar.events.delete>[0]
    >
  ): Promise<Outcome<gapi.client.Response<void>>> {
    const calendar = await loadCalendarApi(this.context.tokenGetter);
    if (!ok(calendar)) return calendar;

    return calendar.events.delete(request);
  }

  async driveListFiles(
    request: NonNullable<Parameters<typeof gapi.client.drive.files.list>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.drive.FileList>>> {
    const drive = await loadDriveApi(this.context.tokenGetter);
    if (!ok(drive)) return drive;

    return drive.files.list(filterUndefined(request));
  }

  async driveGetFile(
    request: Parameters<typeof gapi.client.drive.files.get>[0]
  ): Promise<Outcome<gapi.client.Response<gapi.client.drive.File>>> {
    const drive = await loadDriveApi(this.context.tokenGetter);
    if (!ok(drive)) return drive;

    return drive.files.get(request);
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

async function loadDriveApi(
  tokenGetter: TokenGetter
): Promise<Outcome<typeof gapi.client.drive>> {
  if (!globalThis.gapi) {
    return err("GAPI is not loaded, unable to load Drive API");
  }
  if (!gapi.client) {
    await new Promise((resolve) => gapi.load("client", resolve));
  }
  const access_token = await tokenGetter([
    "https://www.googleapis.com/auth/drive.readonly",
  ]);
  if (!ok(access_token)) {
    return err(access_token.$error);
  }
  gapi.client.setToken({ access_token });
  if (!gapi.client.drive) {
    await gapi.client.load(
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
    );
  }
  return gapi.client.drive;
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
