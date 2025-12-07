/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@maxim_mazurok/gapi.client.calendar-v3" />
/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@maxim_mazurok/gapi.client.gmail-v1" />

import {
  Outcome,
  GOOGLE_CALENDAR_API_PREFIX,
  GOOGLE_DRIVE_API_PREFIX,
  GOOGLE_GMAIL_API_PREFIX,
} from "@breadboard-ai/types";
import { err, ok, filterUndefined } from "@breadboard-ai/utils";
import { McpBuiltInClientFactoryContext } from "../types.js";

export { GoogleApis };

class GoogleApis {
  constructor(private readonly context: McpBuiltInClientFactoryContext) {}

  async #call<Res>(
    url: string,
    method: string,
    body: unknown | undefined
  ): Promise<Outcome<gapi.client.Response<Res>>> {
    const maybeBody =
      method !== "GET" && body
        ? { body: typeof body === "string" ? body : JSON.stringify(body) }
        : {};

    try {
      const response = await this.context.fetchWithCreds(url, {
        method,
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
    builder: MultiPartBuilder
  ): Promise<Outcome<gapi.client.Response<Res[]>>> {
    try {
      const response = await this.context.fetchWithCreds(url, {
        method,
        headers: {
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
      `${GOOGLE_CALENDAR_API_PREFIX}/${calendarId}/events?${query}`,
      "GET",
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
      `${GOOGLE_CALENDAR_API_PREFIX}/${calendarId}/events?${query}`,
      "POST",
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
      `${GOOGLE_CALENDAR_API_PREFIX}/${calendarId}/events/${eventId}?${query}`,
      "PUT",
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
      `${GOOGLE_CALENDAR_API_PREFIX}/${calendarId}/events/${eventId}?${query}`,
      "DELETE",
      undefined
    );
  }

  async driveListFiles(
    request: NonNullable<Parameters<typeof gapi.client.drive.files.list>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.drive.FileList>>> {
    const query = new URLSearchParams(
      filterUndefined(request as Record<string, string>)
    ).toString();

    return this.#call(`${GOOGLE_DRIVE_API_PREFIX}?${query}`, "GET", undefined);
  }

  async driveGetFile(
    request: NonNullable<Parameters<typeof gapi.client.drive.files.get>[0]>
  ): Promise<Outcome<gapi.client.Response<gapi.client.drive.File>>> {
    const { fileId, ...params } = request;

    const query = new URLSearchParams(
      filterUndefined(params as Record<string, string>)
    ).toString();

    return this.#call(
      `${GOOGLE_DRIVE_API_PREFIX}/${fileId}?${query}`,
      "GET",
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
      `${GOOGLE_GMAIL_API_PREFIX}/gmail/v1/users/${userId}/messages?${query}`,
      "GET",
      undefined
    );

    if (!ok(list)) return list;

    const items = list.result.messages;
    if (!items) {
      return [];
    }
    const builder = new MultiPartBuilder();
    for (const message of items) {
      builder.add(`/gmail/v1/users/${userId}/messages/${message.id!}`, "GET");
    }
    const messages = await this.#callMultipart<gapi.client.gmail.Message>(
      `${GOOGLE_GMAIL_API_PREFIX}/batch`,
      "POST",
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
      `${GOOGLE_GMAIL_API_PREFIX}/gmail/v1/users/${userId}/threads?${query}`,
      "GET",
      undefined
    );

    if (!ok(list)) return list;

    const items = list.result.threads;
    if (!items) {
      return [];
    }

    const builder = new MultiPartBuilder();
    for (const thread of items) {
      builder.add(`/gmail/v1/users/${userId}/threads/${thread.id!}`, "GET");
    }

    const threads = await this.#callMultipart<gapi.client.gmail.Thread>(
      `${GOOGLE_GMAIL_API_PREFIX}/batch`,
      "POST",
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
      `${GOOGLE_GMAIL_API_PREFIX}/gmail/v1/users/${userId}/messages/send`,
      "POST",
      body
    );
  }

  async gmailCreateDraft(
    request: Parameters<typeof gapi.client.gmail.users.drafts.create>[0],
    body: gapi.client.gmail.Draft
  ): Promise<Outcome<gapi.client.Response<gapi.client.gmail.Draft>>> {
    const { userId } = request;

    return this.#call(
      `${GOOGLE_GMAIL_API_PREFIX}/gmail/v1/users/${userId}/drafts`,
      "POST",
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
  readonly boundary = `batch-${crypto.randomUUID()}`;

  /**
   * Creates a part in a multi-part message, putting a placeholder in place
   * of the auth token. This placeholder will be replaced with the actual
   * auth token by fetchWithCreds implementation.
   */
  #createPart(url: string, method: string) {
    return `--${this.boundary}
Content-Type: application/http

${method} ${url}

`;
  }

  add(url: string, method: string) {
    this.#parts.push(this.#createPart(url, method));
  }

  createBody(): string {
    return `${this.#parts.join("")}--${this.boundary}`;
  }
}
