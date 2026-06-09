/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ProxyBackedClient } from "../../src/mcp/proxy-backed-client.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../src/ui/config/client-deployment-configuration.js";

describe("ProxyBackedClient", () => {
  let savedFlag: boolean;

  afterEach(() => {
    if (savedFlag !== undefined) {
      CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = savedFlag;
    }
    mock.restoreAll();
  });

  it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off (listTools)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            functionDeclarations: [
              {
                name: "test_tool",
                description: "A test tool",
                parameters: { type: "object", properties: {} },
              },
            ],
          }),
          { status: 200 }
        );
      }
    );

    const client = new ProxyBackedClient({
      name: "test-server",
      url: "https://mcp.example.com",
      proxyUrl: "https://proxy.example.com",
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
    });

    const result = await client.listTools();

    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(
      url.toString(),
      "https://proxy.example.com/v1beta1/listMcpTools"
    );
    assert.equal(init?.method, "POST");

    const bodyObj = JSON.parse(init?.body as string);
    assert.deepStrictEqual(bodyObj, {
      mcpServerConfig: {
        streamableHttp: {
          url: "https://mcp.example.com",
        },
      },
    });

    assert.equal(result.tools.length, 1);
    assert.equal(result.tools[0].name, "test_tool");
  });

  it("uses fetchWithCreds when ENABLE_BACKEND_CLIENT is off (callTool)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = false;

    const fetchMock = mock.fn(
      async (_url: URL | RequestInfo, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: "Tool response" }],
          }),
          { status: 200 }
        );
      }
    );

    const client = new ProxyBackedClient({
      name: "test-server",
      url: "https://mcp.example.com",
      proxyUrl: "https://proxy.example.com",
      token: "secret-token",
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
    });

    const result = await client.callTool({
      name: "test_tool",
      arguments: { arg1: "val" },
    });

    assert.equal(fetchMock.mock.calls.length, 1);
    const [url, init] = fetchMock.mock.calls[0].arguments;
    assert.equal(
      url.toString(),
      "https://proxy.example.com/v1beta1/callMcpTool"
    );
    assert.equal(init?.method, "POST");

    const bodyObj = JSON.parse(init?.body as string);
    assert.deepStrictEqual(bodyObj, {
      mcpServerConfig: {
        streamableHttp: {
          url: "https://mcp.example.com",
          headers: {
            Authorization: "Bearer secret-token",
          },
        },
      },
      functionCall: {
        id: "id",
        name: "test_tool",
        args: { arg1: "val" },
      },
    });

    // McpCallToolResult returned
    assert.deepStrictEqual(result, {
      content: [{ type: "text", text: "Tool response" }],
    });
  });

  it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on (listTools)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response(
          JSON.stringify({
            functionDeclarations: [
              {
                name: "backend_tool",
                description: "A backend tool",
                parameters: { type: "object", properties: {} },
              },
            ],
          }),
          { status: 200 }
        );
      }),
    };

    const fetchMock = mock.fn();

    const client = new ProxyBackedClient({
      name: "test-server",
      url: "https://mcp.example.com",
      proxyUrl: "https://proxy.example.com",
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
    });

    const result = await client.listTools();

    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "listMcpTools");
    assert.equal(options.method, "POST");
    assert.deepStrictEqual(options.body, {
      mcpServerConfig: {
        streamableHttp: {
          url: "https://mcp.example.com",
        },
      },
    });

    assert.equal(result.tools.length, 1);
    assert.equal(result.tools[0].name, "backend_tool");
  });

  it("uses sendHttpRequest when ENABLE_BACKEND_CLIENT is on (callTool)", async () => {
    savedFlag = CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT;
    CLIENT_DEPLOYMENT_CONFIG.ENABLE_BACKEND_CLIENT = true;

    const backendClientMock = {
      sendHttpRequest: mock.fn(async () => {
        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: "Backend tool response" }],
          }),
          { status: 200 }
        );
      }),
    };

    const fetchMock = mock.fn();

    const client = new ProxyBackedClient({
      name: "test-server",
      url: "https://mcp.example.com",
      proxyUrl: "https://proxy.example.com",
      token: "secret-token",
      fetchWithCreds: fetchMock as unknown as typeof globalThis.fetch,
      backendClient: Promise.resolve(backendClientMock as any),
    });

    const result = await client.callTool({
      name: "backend_tool",
      arguments: { arg1: "val" },
    });

    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);
    assert.equal(fetchMock.mock.calls.length, 0);

    const [methodName, options] = backendClientMock.sendHttpRequest.mock
      .calls[0].arguments as unknown as [string, any];
    assert.equal(methodName, "callMcpTool");
    assert.equal(options.method, "POST");
    assert.deepStrictEqual(options.body, {
      mcpServerConfig: {
        streamableHttp: {
          url: "https://mcp.example.com",
          headers: {
            Authorization: "Bearer secret-token",
          },
        },
      },
      functionCall: {
        id: "id",
        name: "backend_tool",
        args: { arg1: "val" },
      },
    });

    assert.deepStrictEqual(result, {
      content: [{ type: "text", text: "Backend tool response" }],
    });
  });
});
