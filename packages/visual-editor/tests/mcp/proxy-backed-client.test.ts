/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ProxyBackedClient } from "../../src/mcp/proxy-backed-client.js";

describe("ProxyBackedClient", () => {
  it("uses sendHttpRequest (listTools)", async () => {
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

    const client = new ProxyBackedClient({
      name: "test-server",
      url: "https://mcp.example.com",
      backendClient: Promise.resolve(backendClientMock as any),
    });

    const result = await client.listTools();

    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);

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

  it("uses sendHttpRequest (callTool)", async () => {
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

    const client = new ProxyBackedClient({
      name: "test-server",
      url: "https://mcp.example.com",
      token: "secret-token",
      backendClient: Promise.resolve(backendClientMock as any),
    });

    const result = await client.callTool({
      name: "backend_tool",
      arguments: { arg1: "val" },
    });

    assert.equal(backendClientMock.sendHttpRequest.mock.calls.length, 1);

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
