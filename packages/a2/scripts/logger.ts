/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Entry, Har } from "har-format";

export { Logger };

type PartialEntry = Partial<Entry>;

class Logger {
  readonly entries: Map<number, PartialEntry> = new Map();

  #currentRequestId = 0;

  request(url: string, init?: RequestInit): number {
    const postDataText = (init?.method === "POST" ? init?.body : undefined) as
      | string
      | undefined;
    const exchange: PartialEntry = {
      startedDateTime: new Date().toISOString(),
      cache: {},
      time: performance.now(),
      _resourceType: "fetch",
      request: {
        url,
        method: init?.method || "GET",
        httpVersion: "HTTP/1.1",
        cookies: [],
        headers: [],
        queryString: [],
        headersSize: 0,
        postData: postDataText
          ? {
              mimeType: "application/json",
              text: postDataText,
            }
          : undefined,
        bodySize: postDataText?.length || 0,
      },
    };
    const requestId = ++this.#currentRequestId;
    this.entries.set(requestId, exchange);
    return requestId;
  }

  async response(id: number, res: Response) {
    const entry = this.entries.get(id);
    if (!entry) {
      console.warn(`Unknown HTTP Exchange ID: "${id}", will drop response`);
      return;
    }
    // TODO: Support types other than text.
    const text = await res.text();
    entry.time = performance.now() - entry.time!;
    entry.timings = {
      send: 0,
      wait: 0,
      receive: entry.time,
    };
    const mimeType = res.headers.get("Content-Type") || "application/json";
    entry.response = {
      status: res.status,
      statusText: res.statusText,
      httpVersion: "HTTP/1.1",
      cookies: [],
      headers: [...res.headers.entries()].map(([name, value]) => ({
        name,
        value,
      })),
      content: {
        size: text.length,
        mimeType,
        text,
      },
      redirectURL: "",
      bodySize: text.length,
      headersSize: -1,
    };
  }

  getHar(): Har {
    return {
      log: {
        version: "1.1",
        creator: {
          name: "Breadboard Eval Harness",
          version: "0.1",
        },
        entries: [...this.entries.values()] as Entry[],
      },
    };
  }
}
