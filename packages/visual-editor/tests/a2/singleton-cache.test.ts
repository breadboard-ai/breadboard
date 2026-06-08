/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getSingletonPrefixCache } from "../../src/a2/a2/singleton-cache.js";
import { stubModuleArgs } from "../useful-stubs.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../src/ui/config/client-deployment-configuration.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

describe("getSingletonPrefixCache", () => {
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
              name: "cachedContents/singleton-cache-id",
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

    const result = await getSingletonPrefixCache(moduleArgs, {
      useMemory: true,
      useNotebookLM: false,
      useGoogleDrive: true,
    });

    assert.ok(ok(result));
    assert.equal(result, "cachedContents/singleton-cache-id");
    assert.equal(fetchMock.mock.calls.length, 1);

    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(
      url.toString(),
      "https://appcatalyst.pa.googleapis.com/v1beta1/getSingletonPrefixCache"
    );
    assert.equal(init?.method, "POST");
    assert.equal(
      init?.body,
      JSON.stringify({
        useMemory: true,
        useNotebookLM: false,
        useGoogleDrive: true,
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
              name: "cachedContents/backend-singleton-cache-id",
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

    const result = await getSingletonPrefixCache(moduleArgs, {
      useMemory: true,
      useNotebookLM: false,
      useGoogleDrive: true,
    });

    assert.ok(ok(result));
    assert.equal(result, "cachedContents/backend-singleton-cache-id");
    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "getSingletonPrefixCache");
    assert.equal(options.method, "POST");
    assert.deepStrictEqual(options.body, {
      useMemory: true,
      useNotebookLM: false,
      useGoogleDrive: true,
    });
  });
});
