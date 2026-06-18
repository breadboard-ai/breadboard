/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createCachedContent } from "../../src/a2/a2/cached-content.js";
import { stubModuleArgs } from "../useful-stubs.js";
import { ok } from "@breadboard-ai/utils/outcome.js";

describe("createCachedContent", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("creates cached content via backend client", async () => {
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

    const moduleArgs = {
      ...stubModuleArgs,
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
