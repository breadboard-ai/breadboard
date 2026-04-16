/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { A2ModuleArgs } from "../../runnable-module-factory.js";
import { McpClient } from "../../../mcp/apis/mcp-client.js";
import { FunctionDeclaration } from "../../a2/gemini.js";
import { assembleFunctionGroup } from "../function-definition.js";
import { FunctionGroup } from "../types.js";
import { TaskTreeManager } from "../task-tree-manager.js";
import { CLIENT_DEPLOYMENT_CONFIG } from "../../../ui/config/client-deployment-configuration.js";

const GOOGLE_GMAIL_API_PREFIX =
  CLIENT_DEPLOYMENT_CONFIG.GOOGLE_GMAIL_MCP_ENDPOINT ?? "";

export { getGmailFunctionGroup };

export type GmailFunctionArgs = {
  moduleArgs: A2ModuleArgs;
  taskTreeManager: TaskTreeManager;
};

function getGmailFunctionGroup(args: GmailFunctionArgs): FunctionGroup {
  const { moduleArgs } = args;

  const declarations: FunctionDeclaration[] = [
    {
      name: "gmailmcp_create_draft",
      description: "Creates a new draft email in the authenticated user's Gmail account.\n\nThis tool takes recipient addresses, a subject, and body content as inputs. It returns the ID of the created Gmail draft.\n",
      parameters: {
        type: "object",
        properties: {
          to: { type: "array", items: { type: "string" }, description: "Required. Primary recipients." },
          subject: { type: "string", description: "Optional. Topic." },
          body: { type: "string", description: "Optional. Plain text." },
          htmlBody: { type: "string", description: "Optional. HTML." },
          cc: { type: "array", items: { type: "string" }, description: "Optional. CC." },
          bcc: { type: "array", items: { type: "string" }, description: "Optional. BCC." },
        },
        required: ["to"],
      },
    },
    {
      name: "gmailmcp_get_thread",
      description: "Retrieves a specific email thread from the authenticated user's Gmail account, including a list of its messages.\n",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "Required. The unique identifier of the thread to fetch." },
          messageFormat: {
            type: "string",
            enum: ["MESSAGE_FORMAT_UNSPECIFIED", "MINIMAL", "FULL_CONTENT"],
            description: "Optional. Specifies the format of the messages returned.",
          },
        },
        required: ["threadId"],
      },
    },
    {
      name: "gmailmcp_label_message",
      description: "Adds one or more labels to a specific message in the authenticated user's Gmail account.\\n To find the message ID, use tools like `search_threads` or `get_thread`. If unsure of a user label's ID, use the `list_labels` tool first to discover available labels and their IDs.\\n",
      parameters: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "Required. Unique message identifier." },
          labelIds: { type: "array", items: { type: "string" }, description: "Required. Unique label identifiers to add." },
        },
        required: ["messageId", "labelIds"],
      },
    },
    {
      name: "gmailmcp_label_thread",
      description: "Adds labels to an entire thread in the authenticated user's Gmail account. This operation affects all messages currently in the thread and any future messages added to it.\n\nIf unsure of the thread ID, use the `search_threads` tool first.\n\nIf unsure of a user label's ID, use the `list_labels` tool first to discover available labels and their IDs.\n",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "Required. The unique identifier of the thread." },
          labelIds: { type: "array", items: { type: "string" }, description: "Required. The unique identifiers of the labels to add." },
        },
        required: ["threadId", "labelIds"],
      },
    },
    {
      name: "gmailmcp_list_drafts",
      description: "Lists draft emails from the authenticated user's Gmail account.\n\nThis tool can filter drafts based on a query string and supports pagination. It returns a list of drafts, including their IDs and subjects.\n",
      parameters: {
        type: "object",
        properties: {
          pageSize: { type: "integer", description: "Optional. Max results." },
          pageToken: { type: "string", description: "Optional. Token." },
          query: { type: "string", description: "Optional. Filter query." },
        },
      },
    },
    {
      name: "gmailmcp_list_labels",
      description: "Lists all user-defined labels available in the authenticated user's Gmail account. Use this tool to discover the `id` of a user label before calling `label_thread`, `unlabel_thread`, `label_message`, or `unlabel_message`. System labels are not returned by this tool but can be used with their well-known IDs: 'INBOX', 'TRASH', 'SPAM', 'STARRED', 'UNREAD', 'IMPORTANT', 'CHAT', 'DRAFT', 'SENT'.\\n",
      parameters: {
        type: "object",
        properties: {
          pageSize: { type: "integer", description: "Optional. The maximum number of labels to return." },
          pageToken: { type: "string", description: "Optional. Page token." },
        },
      },
    },
    {
      name: "gmailmcp_search_threads",
      description: "Lists email threads from the authenticated user's Gmail account.\n\nThis tool can filter threads based on a query string and supports pagination. It returns a list of threads, including their IDs and related messages. Each related message contains details like a snippet of the message body, the subject, the sender, the recipients etc. Note that the full message bodies are not returned by this tool; use the 'get_thread' tool with a thread ID to fetch the full message body if needed.\n",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional. A query string to filter the threads." },
          pageSize: { type: "integer", description: "Optional. Max results to return. Default 20, max 50." },
          pageToken: { type: "string", description: "Optional. Page token." },
          includeTrash: { type: "boolean", description: "Optional. Include drafts from TRASH. Default false." },
        },
      },
    },
    {
      name: "gmailmcp_unlabel_message",
      description: "Removes one or more labels from a specific message in the authenticated user's Gmail account.\\n To find the message ID, use tools like `search_threads` or `get_thread`. If unsure of a user label's ID, use the `list_labels` tool first to discover available labels and their IDs.\\n",
      parameters: {
        type: "object",
        properties: {
          messageId: { type: "string", description: "Required. Unique message identifier." },
          labelIds: { type: "array", items: { type: "string" }, description: "Required. Unique label identifiers to remove." },
        },
        required: ["messageId", "labelIds"],
      },
    },
    {
      name: "gmailmcp_unlabel_thread",
      description: "Removes labels from an entire thread in the authenticated user's Gmail account. If unsure of the thread ID, use the `search_threads` tool first. If unsure of a user label's ID, use the `list_labels` tool first.",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "Required. Unique thread identifier." },
          labelIds: { type: "array", items: { type: "string" }, description: "Required. Unique label identifiers to remove." },
        },
        required: ["threadId", "labelIds"],
      },
    },
  ];

  return assembleFunctionGroup(declarations, {}, "", {
    gmailmcp_create_draft: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("create_draft", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_get_thread: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("get_thread", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_label_message: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("label_message", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_label_thread: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("label_thread", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_list_drafts: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("list_drafts", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_list_labels: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("list_labels", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_search_threads: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("search_threads", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_unlabel_message: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("unlabel_message", inputs);
      } finally {
        await client.close();
      }
    },
    gmailmcp_unlabel_thread: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp/v1", GOOGLE_GMAIL_API_PREFIX));
      await client.connect();
      try {
        return await client.callTool("unlabel_thread", inputs);
      } finally {
        await client.close();
      }
    },
  });
}
