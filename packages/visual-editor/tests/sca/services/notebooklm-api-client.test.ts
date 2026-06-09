/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { NotebookLmApiClient } from "../../../src/sca/services/notebooklm-api-client.js";

describe("NotebookLmApiClient", () => {
  it("uses sendHttpRequest for retrieveRelevantChunks", async () => {
    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response(JSON.stringify({ sourceContexts: [] }), {
          status: 200,
        });
      }),
    };

    const fetchMock = mock.fn();

    const client = new NotebookLmApiClient(
      fetchMock as unknown as typeof globalThis.fetch,
      "https://notebooklm.googleapis.com",
      Promise.resolve(backendClientMock as any)
    );

    const result = await client.retrieveRelevantChunks({
      name: "notebooks/test-notebook",
      query: "test query",
    });

    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "nlmRetrieveRelevantChunks");
    assert.equal(options.method, "POST");
    assert.deepStrictEqual(options.body, {
      query: "test query",
      notebook: "notebooks/test-notebook",
    });
    assert.deepStrictEqual(result, { sourceContexts: [] });
  });

  it("uses fetchWithCreds for listNotebooks (direct Partner API path)", async () => {
    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(JSON.stringify({ notebooks: [] }), {
          status: 200,
        });
      }
    );

    const backendClientMock = {
      sendHttpRequest: mock.fn(),
    };

    const client = new NotebookLmApiClient(
      fetchMock as unknown as typeof globalThis.fetch,
      "https://notebooklm.googleapis.com",
      Promise.resolve(backendClientMock as any)
    );

    const result = await client.listNotebooks({
      filter: "name=test",
    });

    assert.equal(fetchMock.mock.calls.length, 1);
    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 0);

    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(
      url.toString(),
      "https://notebooklm.googleapis.com/v1/notebooks?filter=name%3Dtest&provenance.originProductType=GOOGLE_NOTEBOOKLM_EVALS&provenance.clientInfo.applicationPlatform=WEB&provenance.clientInfo.device=DESKTOP"
    );
    assert.equal(init?.method, "GET");
    assert.deepStrictEqual(result, { notebooks: [] });
  });
});
