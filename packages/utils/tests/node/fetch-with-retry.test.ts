/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { equal, ok } from "node:assert";
import { afterEach, beforeEach, mock, suite, test } from "node:test";
import { fetchWithRetry } from "../../src/fetch-with-retry.js";

const originalSetTimeout = globalThis.setTimeout;
let setTimeoutCalls: number[] = [];

beforeEach(() => {
  setTimeoutCalls = [];
  mock.method(globalThis, "setTimeout", (cb: () => void, ms: number) => {
    setTimeoutCalls.push(ms);
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  });
});

afterEach(() => {
  mock.restoreAll();
});

suite("fetchWithRetry", () => {
  test("returns response on success", async () => {
    const fakeFetch = mock.fn(async () => new Response("ok", { status: 200 }));
    const response = await fetchWithRetry(fakeFetch, "https://example.com");
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 1);
    equal(setTimeoutCalls.length, 0);
  });

  for (const status of [400, 401, 403, 404, 429, 499]) {
    test(`does not retry on ${status}`, async () => {
      const fakeFetch = mock.fn(async () => new Response(null, { status }));
      const response = await fetchWithRetry(fakeFetch, "https://example.com");
      equal(response.status, status);
      equal(fakeFetch.mock.callCount(), 1);
      equal(setTimeoutCalls.length, 0);
    });
  }

  for (const status of [500, 599]) {
    test(`retries on ${status}`, async () => {
      const fakeFetch = mock.fn(async () => new Response(null, { status }));
      const response = await fetchWithRetry(fakeFetch, "https://example.com");
      equal(response.status, status);
      equal(fakeFetch.mock.callCount(), 3);
      equal(setTimeoutCalls.length, 2);
    });
  }

  test("retries on 5xx and eventually succeeds", async () => {
    let call = 0;
    const fakeFetch = mock.fn(async () => {
      call++;
      if (call < 3) {
        return new Response(null, { status: 500 });
      }
      return new Response("ok", { status: 200 });
    });
    const response = await fetchWithRetry(fakeFetch, "https://example.com");
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 3);
    equal(setTimeoutCalls.length, 2);
  });

  test("returns last 5xx response after exhausting attempts", async () => {
    const fakeFetch = mock.fn(async () => new Response(null, { status: 503 }));
    const response = await fetchWithRetry(fakeFetch, "https://example.com");
    equal(response.status, 503);
    equal(fakeFetch.mock.callCount(), 3);
    equal(setTimeoutCalls.length, 2);
  });

  test("returns 403 when fetch throws", async () => {
    const fakeFetch = mock.fn(async () => {
      throw new Error("network error");
    });
    const response = await fetchWithRetry(fakeFetch, "https://example.com");
    equal(response.status, 403);
    equal(fakeFetch.mock.callCount(), 3);
    equal(setTimeoutCalls.length, 2);
  });

  test("retries when fetch throws, then succeeds", async () => {
    let call = 0;
    const fakeFetch = mock.fn(async () => {
      call++;
      if (call === 1) {
        throw new Error("network error");
      }
      return new Response("ok", { status: 200 });
    });
    const response = await fetchWithRetry(fakeFetch, "https://example.com");
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 2);
    equal(setTimeoutCalls.length, 1);
  });

  test("passes input and init to fetch", async () => {
    const init: RequestInit = { method: "POST", body: "data" };
    const fakeFetch = mock.fn(
      async (_input: string | Request | URL, _init?: RequestInit) =>
        new Response("ok", { status: 200 })
    );
    await fetchWithRetry(fakeFetch, "https://example.com/api", init);
    const call = fakeFetch.mock.calls[0];
    ok(call);
    equal(call.arguments[0], "https://example.com/api");
    equal(call.arguments[1], init);
    equal(setTimeoutCalls.length, 0);
  });

  test("actually awaits the delay between retries", async () => {
    mock.restoreAll();
    mock.method(globalThis, "setTimeout", (cb: () => void, ms: number) => {
      setTimeoutCalls.push(ms);
      return originalSetTimeout(cb, 50);
    });
    let call = 0;
    const fakeFetch = mock.fn(async () => {
      call++;
      if (call === 1) {
        return new Response(null, { status: 500 });
      }
      return new Response("ok", { status: 200 });
    });
    const promise = fetchWithRetry(fakeFetch, "https://example.com");
    await new Promise((r) => originalSetTimeout(r, 10));
    equal(fakeFetch.mock.callCount(), 1);
    const response = await promise;
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 2);
  });
});
