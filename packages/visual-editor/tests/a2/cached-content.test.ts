/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createCachedContent } from "../../src/a2/a2/cached-content.js";
import { stubModuleArgs } from "../useful-stubs.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../src/ui/config/client-deployment-configuration.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

describe("createCachedContent", () => {
  let savedFlag: boolean;

  afterEach(() => {
    if (savedFlag !== undefined) {
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = savedFlag;
    }
    mock.restoreAll();
  });

  it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            cachedContent: {
              name: "cachedContents/test-cache-id",
            },
          }),
          { status: 200 }
        );
      }
    );

    const moduleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
    };

    const result = await createCachedContent(
      moduleArgs,
      "gemini-2.5-flash",
      {
        contents: [{ role: "user", parts: [{ text: "Cached text" }] }],
      }
    );

    assert.ok(ok(result));
    assert.equal(result, "cachedContents/test-cache-id");
    assert.equal(fetchMock.mock.calls.length, 1);

    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(
      url.toString(),
      "https://appcatalyst.pa.googleapis.com/v1beta1/createCachedContent"
    );
    assert.equal(init?.method, "POST");
    assert.equal(
      init?.body,
      JSON.stringify({
        cachedContent: {
          model: "models/gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: "Cached text" }] }],
        },
      })
    );
  });

  it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response(
          JSON.stringify({
            cachedContent: {
              name: "cachedContents/backend-cache-id",
            },
          }),
          { status: 200 }
        );
      }),
    };

    const fetchMock = mock.fn();

    const moduleArgs = {
      ...stubModuleArgs,
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
    };

    const result = await createCachedContent(
      moduleArgs,
      "gemini-2.5-flash",
      {
        contents: [{ role: "user", parts: [{ text: "Cached text" }] }],
      }
    );

    assert.ok(ok(result));
    assert.equal(result, "cachedContents/backend-cache-id");
    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "createCachedContent");
    assert.equal(options.method, "POST");
    assert.deepStrictEqual(options.body, {
      cachedContent: {
        model: "models/gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "Cached text" }] }],
        tools: undefined,
        toolConfig: undefined,
        systemInstruction: undefined,
      },
    });
  });
});
