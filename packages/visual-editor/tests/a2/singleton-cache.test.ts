/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getSingletonPrefixCache } from "../../src/a2/a2/singleton-cache.js";
import { stubModuleArgs } from "../useful-stubs.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

describe("getSingletonPrefixCache", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("fetches singleton prefix cache via backend client", async () => {
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

    const moduleArgs = {
      ...stubModuleArgs,
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
