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
  GOOGLE_DRIVE_FILES_API_PREFIX,
} from "@breadboard-ai/types";
import { err, filterUndefined } from "@breadboard-ai/utils";
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

    return this.#call(
      `${GOOGLE_DRIVE_FILES_API_PREFIX}?${query}`,
      "GET",
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
      `${GOOGLE_DRIVE_FILES_API_PREFIX}/${fileId}?${query}`,
      "GET",
      undefined
    );
  }
}
