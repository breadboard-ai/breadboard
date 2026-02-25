/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { equal, ok } from "node:assert";
import { mock, suite, test, afterEach } from "node:test";
import { fetchWithRetry } from "../../src/fetch-with-retry.js";

afterEach(() => {
  mock.restoreAll();
});

suite("fetchWithRetry", () => {
  test("returns response on success", async () => {
    const fakeFetch = mock.fn(async () => new Response("ok", { status: 200 }));
    const response = await fetchWithRetry(fakeFetch, "https://example.com");
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 1);
  });

  for (const status of [400, 401, 403, 404, 429]) {
    test(`does not retry on ${status}`, async () => {
      const fakeFetch = mock.fn(async () => new Response(null, { status }));
      const response = await fetchWithRetry(fakeFetch, "https://example.com");
      equal(response.status, status);
      equal(fakeFetch.mock.callCount(), 1);
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
    const response = await fetchWithRetry(
      fakeFetch,
      "https://example.com",
      undefined,
      3
    );
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 3);
  });

  test("returns last 5xx response after exhausting attempts", async () => {
    const fakeFetch = mock.fn(async () => new Response(null, { status: 503 }));
    const response = await fetchWithRetry(
      fakeFetch,
      "https://example.com",
      undefined,
      2
    );
    equal(response.status, 503);
    equal(fakeFetch.mock.callCount(), 2);
  });

  test("returns 403 when fetch throws", async () => {
    const fakeFetch = mock.fn(async () => {
      throw new Error("network error");
    });
    const response = await fetchWithRetry(
      fakeFetch,
      "https://example.com",
      undefined,
      1
    );
    equal(response.status, 403);
    equal(fakeFetch.mock.callCount(), 1);
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
    const response = await fetchWithRetry(
      fakeFetch,
      "https://example.com",
      undefined,
      2
    );
    equal(response.status, 200);
    equal(fakeFetch.mock.callCount(), 2);
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
  });

  test("defaults to 3 attempts", async () => {
    const fakeFetch = mock.fn(async () => new Response(null, { status: 500 }));
    await fetchWithRetry(fakeFetch, "https://example.com");
    equal(fakeFetch.mock.callCount(), 3);
  });
});
