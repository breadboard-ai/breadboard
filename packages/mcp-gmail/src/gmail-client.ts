/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@maxim_mazurok/gapi.client.gmail-v1" />

import {
  BuiltInClient,
  McpBuiltInClient,
  mcpErr,
  mcpText,
  TokenGetter,
} from "@breadboard-ai/mcp";
import { Outcome } from "@breadboard-ai/types";
import { err, ok } from "@breadboard-ai/utils";

export { createGmailClient };

function createGmailClient(tokenGetter: TokenGetter): McpBuiltInClient {
  const client = new BuiltInClient({
    name: "GMail",
    url: "builtin:gmail",
  });

  client.addTool(
    "gmail_list_emails",
    {
      title: "List emails",
      description: "Lists the messages in the user's GMail mailbox.",
    },
    async () => {
      const gmail = await loadGmailApi(tokenGetter);
      if (!ok(gmail)) {
        return mcpErr(gmail.$error);
      }
      const listing = await gmail.users.messages.list({
        userId: "me",
        labelIds: ["INBOX"],
      });
      if (listing.status !== 200) {
        return mcpErr(listing.statusText || "Unable to list GMail messages.");
      }
      return mcpText(JSON.stringify(listing.result));
    }
  );

  return client;
}

async function loadGmailApi(
  tokenGetter: TokenGetter
): Promise<Outcome<typeof gapi.client.gmail>> {
  if (!globalThis.gapi) {
    return err("GAPI is not loaded, unable to query Google Mail");
  }
  if (!gapi.client) {
    await new Promise((resolve) => gapi.load("client", resolve));
  }
  const access_token = await tokenGetter([
    "https://www.googleapis.com/auth/gmail.readonly",
  ]);
  if (!ok(access_token)) {
    return err(access_token.$error);
  }
  gapi.client.setToken({ access_token });
  if (!gapi.client.gmail) {
    await gapi.client.load(
      "https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"
    );
  }
  return gapi.client.gmail;
}
