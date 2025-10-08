/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@maxim_mazurok/gapi.client.calendar-v3" />
/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@maxim_mazurok/gapi.client.gmail-v1" />

import { Outcome } from "@breadboard-ai/types";
import { err, ok, filterUndefined } from "@breadboard-ai/utils";
import { McpBuiltInClientFactoryContext } from "../types.js";
import { OAuthScope } from "@breadboard-ai/connection-client/oauth-scopes.js";

export { GoogleApis };

const CALENDAR_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.owned",
];

const DRIVE_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/drive.readonly",
];

const GMAIL_SCOPES: OAuthScope[] = [
  "https://www.googleapis.com/auth/gmail.modify",
];

class GoogleApis {
  constructor(private readonly context: McpBuiltInClientFactoryContext) {}

  async #call<Res>(
    url: string,
    method: string,
    scopes: OAuthScope[],
    body: unknown | undefined
  ): Promise<Outcome<gapi.client.Response<Res>>> {
    const token = await this.context.tokenGetter(scopes);

    const maybeBody =
      method !== "GET" && body
        ? { body: typeof body === "string" ? body : JSON.stringify(body) }
        : {};

    try {
      const response = await this.context.fetchWithCreds(url, {
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

  async #callMultipart<Res>(
    url: string,
    method: string,
    scopes: OAuthScope[],
    builder: MultiPartBuilder
  ): Promise<Outcome<gapi.client.Response<Res[]>>> {
    const token = await this.context.tokenGetter(scopes);

    try {
      const response = await this.context.fetchWithCreds(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ["Content-Type"]: `multipart/mixed; boundary=${builder.boundary}`,
        },
        body: builder.createBody(),
      });

      if (!response.ok) {
        return err(response.statusText);
      }

      const body = await response.text();

      const responseBoundary = response.headers
        .get("Content-Type")
        ?.match(/boundary=(.*)/)?.[1];
      if (!responseBoundary) {
        return err(`No boundary specified in "Content-Type" response header`);
      }
      const result = body
        .split(`--${responseBoundary}`)
        .filter((part) => part.trim() !== "" && !part.trim().startsWith("--"))
        .map((part) => {
          const partBody = part.split(/\r?\n\r?\n/).at(2);
          if (!partBody) {
            throw new Error(`Unable to find body in multipart part`);
          }
          return JSON.parse(partBody) as Res;
        });

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
      CALENDAR_SCOPES,
      undefined
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
      CALENDAR_SCOPES,
      undefined
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
      DRIVE_SCOPES,
      undefined
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
      DRIVE_SCOPES,
      undefined
    );
  }

  async gmailGetMessages(
    request: NonNullable<
      Parameters<typeof gapi.client.gmail.users.messages.list>[0]
    >
  ): Promise<Outcome<gapi.client.gmail.Message[]>> {
    const { userId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params as Record<string, string>)
    ).toString();

    const list = await this.#call<gapi.client.gmail.ListMessagesResponse>(
      `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages?${query}`,
      "GET",
      GMAIL_SCOPES,
      undefined
    );

    if (!ok(list)) return list;

    const items = list.result.messages;
    if (!items) {
      return [];
    }
    const token = await this.context.tokenGetter(GMAIL_SCOPES);
    if (!ok(token)) return token;

    const builder = new MultiPartBuilder(token);
    for (const message of items) {
      builder.add(`/gmail/v1/users/${userId}/messages/${message.id!}`, "GET");
    }
    const messages = await this.#callMultipart<gapi.client.gmail.Message>(
      `https://gmail.googleapis.com/batch`,
      "POST",
      GMAIL_SCOPES,
      builder
    );

    if (!ok(messages)) return messages;

    return Object.values(messages.result).map(trimMessage);
  }

  async gmailGetThreads(
    request: NonNullable<
      Parameters<typeof gapi.client.gmail.users.threads.list>[0]
    >
  ): Promise<Outcome<gapi.client.gmail.Thread[]>> {
    const { userId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params as Record<string, string>)
    ).toString();

    const list = await this.#call<gapi.client.gmail.ListThreadsResponse>(
      `https://gmail.googleapis.com/gmail/v1/users/${userId}/threads?${query}`,
      "GET",
      GMAIL_SCOPES,
      undefined
    );

    if (!ok(list)) return list;

    const items = list.result.threads;
    if (!items) {
      return [];
    }

    const token = await this.context.tokenGetter(GMAIL_SCOPES);
    if (!ok(token)) return token;

    const builder = new MultiPartBuilder(token);
    for (const thread of items) {
      builder.add(`/gmail/v1/users/${userId}/threads/${thread.id!}`, "GET");
    }

    const threads = await this.#callMultipart<gapi.client.gmail.Thread>(
      `https://gmail.googleapis.com/batch`,
      "POST",
      GMAIL_SCOPES,
      builder
    );

    if (!ok(threads)) return threads;

    return threads.result.map((res) => {
      const messages = res.messages?.map(trimMessage);
      return { ...res, messages };
    });
  }

  async gmailSendMessage(
    request: NonNullable<
      Parameters<typeof gapi.client.gmail.users.messages.send>
    >[0],
    body: gapi.client.gmail.Message
  ): Promise<Outcome<gapi.client.Response<gapi.client.gmail.Message>>> {
    const { userId } = request;
    return this.#call(
      `https://gmail.googleapis.com/gmail/v1/users/${userId}/messages/send`,
      "POST",
      GMAIL_SCOPES,
      body
    );
  }

  async gmailCreateDraft(
    request: Parameters<typeof gapi.client.gmail.users.drafts.create>[0],
    body: gapi.client.gmail.Draft
  ): Promise<Outcome<gapi.client.Response<gapi.client.gmail.Draft>>> {
    const { userId } = request;

    return this.#call(
      `https://gmail.googleapis.com/gmail/v1/users/${userId}/drafts`,
      "POST",
      GMAIL_SCOPES,
      body
    );
  }
}

function trimMessage(message: gapi.client.gmail.Message) {
  delete message.historyId;
  delete message.payload;
  delete message.sizeEstimate;
  delete message.raw;
  return message;
}

class MultiPartBuilder {
  #parts: string[] = [];
  readonly boundary = `batch${Date.now()}`;

  #requestHeaders: string = [
    `X-JavaScript-User-Agent: google-api-javascript-client/1.1.0`,
    `X-Requested-With: XMLHttpRequest`,
    `X-Goog-Encode-Response-If-Executable: base64`,
  ].join("\r\n");

  constructor(private readonly token: string) {}

  #createPart(url: string, method: string) {
    return `--${this.boundary}
Content-Type: application/http

${method} ${url}
Authorization: Bearer ${this.token}

`;
  }

  add(url: string, method: string) {
    this.#parts.push(this.#createPart(url, method));
  }

  createBody(): string {
    return `${this.#parts.join("")}--${this.boundary}`;
  }
}
