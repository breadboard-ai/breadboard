/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { filterUndefined, ok } from "@breadboard-ai/utils";
import { createMimeMessage } from "mimetext/browser";
import { z } from "zod";
import { BuiltInClient } from "../built-in-client.js";
import { McpBuiltInClient, McpBuiltInClientFactoryContext } from "../types.js";
import { mcpErr, mcpText } from "../utils.js";
import { GoogleApis } from "../apis/google.js";

export { createGmailClient };

const Q_DESCRIPTION = `Only return messages matching the specified query. Supports the same query format as the Gmail search box.

Supported Gmail Search Operators

### People and Recipients
- \`from:<email>\`: Find emails from a specific sender. Example: \`from:amy@example.com\`
- \`to:<email>\`: Find emails sent to a specific person. Example: \`to:me\`
- \`cc:<email>\`: Find emails that have a specific person in the 'cc' field.
- \`bcc:<email>\`: Find emails that have a specific person in the 'bcc' field.
- \`deliveredto:<email>\`: Find emails delivered to a specific address in the headers. Example: \`deliveredto:username@example.com\`
- \`list:<email>\`: Find emails from a specific mailing list. Example: \`list:info@example.com\`

### Time and Date
- \`after:YYYY/MM/DD\`: Messages sent or received after a specific date.
- \`before:YYYY/MM/DD\`: Messages sent or received before a specific date.
- \`older:YYYY/MM/DD\`: Alias for \`before\`.
- \`newer:YYYY/MM/DD\`: Alias for \`after\`.
- \`older_than:<duration>\`: Messages older than a specific duration (e.g., \`2d\` for 2 days, \`3m\` for 3 months, \`1y\` for 1 year).
- \`newer_than:<duration>\`: Messages newer than a specific duration.

### Content and Keywords
- \`subject:<text>\`: Find emails by words in the subject line. Example: \`subject:"dinner party"\`
- \`"<phrase>"\`: Search for an exact word or phrase. Example: \`"dinner and film tonight"\`
- \`+<word>\`: Forces an exact match on a word. Example: \`+unicorn\`
- \`(<terms>)\`: Group multiple search terms. Example: \`subject:(dinner film)\`
- \`AROUND\`: Find words near each other. The number specifies the maximum word distance. Example: \`holiday AROUND 10 vacation\`

### Logical Operators
- \`OR\` or \`{ }\`: Find emails that match one of several criteria. Example: \`from:amy OR from:david\` or \`{from:amy from:david}\`
- \`AND\`: Find emails that match all criteria (this is the default behavior). Example: \`from:amy AND to:david\`
- \`-<term>\`: Exclude emails that match a term. Example: \`dinner -film\`

### Labels, Categories, and Location
- \`label:<label_name>\`: Find emails with a specific label. Example: \`label:work\`
- \`category:<category_name>\`: Find emails in a specific inbox category. Examples: \`category:primary\`, \`category:social\`, \`category:promotions\`
- \`in:anywhere\`: Search all of Gmail, including Spam and Trash.
- \`in:archive\`: Search only for archived messages.
- \`in:snoozed\`: Search only for snoozed messages.
- \`has:userlabels\`: Find messages that have any custom label.
- \`has:nouserlabels\`: Find messages that do not have any custom labels.

### Attachments
- \`has:attachment\`: Find emails that have any attachment.
- \`has:drive\`, \`has:document\`, \`has:spreadsheet\`, \`has:presentation\`: Find emails with linked Google Drive files.
- \`has:youtube\`: Find emails with YouTube video links.
- \`filename:<name_or_type>\`: Find emails with an attachment of a certain name or file type. Example: \`filename:pdf\` or \`filename:homework.txt\`

### Status and Attributes
- \`is:read\`, \`is:unread\`: Filter by read status.
- \`is:starred\`: Find starred messages.
- \`is:important\`: Find messages marked as important.
- \`is:muted\`: Find messages in muted conversations.
- \`has:<star_name>\`: Find messages with a specific star type. Examples: \`has:yellow-star\`, \`has:blue-info\`, \`has:red-bang\`.
- \`label:encryptedmail\`: Find emails sent with client-side encryption.

### Size
- \`size:<bytes>\`: Find emails of a specific size in bytes. Example: \`size:1000000\`
- \`larger:<size>\`: Find emails larger than a specific size. Example: \`larger:10M\`
- \`smaller:<size>\`: Find emails smaller than a specific size. Example: \`smaller:500K\`

### Advanced
- \`rfc822msgid:<message-id>\`: Find an email by its RFC 822 message ID header`;

const LABEL_IDS_DESCRIPTION = `Only return messages with labels that match all of the specified label IDs. Messages in a thread might have labels that other messages in the same thread don't have.

 Gmail labels are used to categorize emails and come in two varieties: SYSTEM and USER.

1.  **SYSTEM Labels**: These are predefined labels that correspond to elements in the Gmail interface. Their names are reserved and cannot be used for user-created labels. The most common system labels are:
  * \`INBOX\`: Messages in the main inbox.
  * \`SPAM\`: Messages marked as spam.
  * \`TRASH\`: Messages in the trash.
  * \`UNREAD\`: All unread messages.
  * \`STARRED\`: Messages marked with a star.
  * \`IMPORTANT\`: Messages Gmail has marked as important.
  * \`SENT\`: Messages sent by the user. This label is applied automatically and cannot be applied manually.
  * \`DRAFT\`: Draft messages. This label is applied automatically.
  * \`CATEGORY_PERSONAL\`: Messages in the "Personal" tab.
  * \`CATEGORY_SOCIAL\`: Messages in the "Social" tab.
  * \`CATEGORY_PROMOTIONS\`: Messages in the "Promotions" tab.
  * \`CATEGORY_UPDATES\`: Messages in the "Updates" tab.
  * \`CATEGORY_FORUMS\`: Messages in the "Forums" tab.

2.  **USER Labels**: These are custom labels created by the user for their own organization (e.g., "Work," "Receipts," "Project X"). You can use these labels just like system labels when a particular label name is requested.`;

const LIST_INPUT_SCHEMA = {
  maxResults: z
    .number()
    .describe(
      `Maximum number of messages to return. This field defaults to 100. The maximum allowed value for this field is 500.`
    )
    .optional(),
  q: z.string().describe(Q_DESCRIPTION).optional(),
  labelIds: z.array(z.string()).describe(LABEL_IDS_DESCRIPTION).optional(),
  includeSpamTrash: z
    .boolean()
    .describe(`Include messages from SPAM and TRASH in the results.`)
    .optional(),
};

const SEND_INPUT_SCHEMA = {
  to: z
    .array(z.string())
    .describe(`The list of emails addresses of the message recipients`),
  cc: z
    .array(z.string())
    .describe(
      `The list of email addresses of the message carbon copy (cc) receipients`
    ),
  bcc: z
    .array(z.string())
    .describe(
      `The list of email addresses of the message blind caron copy (bcc) recipients`
    ),
  subject: z.string().describe(`The subject of the email message`),
  content: z
    .string()
    .describe(
      `The content of the message. Must be in plain text, HTML messages are not supported`
    ),
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SEND_ZOD_OBJECT = z.object(SEND_INPUT_SCHEMA);

type MessageComponents = z.infer<typeof SEND_ZOD_OBJECT>;

function createGmailClient(
  context: McpBuiltInClientFactoryContext
): McpBuiltInClient {
  const google = new GoogleApis(context);
  const client = new BuiltInClient({
    name: "GMail",
    url: "builtin:gmail",
  });

  client.addTool(
    "gmail_list_emails",
    {
      title: "List emails",
      description: "Lists the messages in the user's GMail",
      inputSchema: LIST_INPUT_SCHEMA,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ q, labelIds, includeSpamTrash, maxResults }) => {
      const getting = await google.gmailGetMessages(
        filterUndefined({
          q,
          userId: "me",
          labelIds,
          includeSpamTrash,
          maxResults,
        })
      );
      if (!ok(getting)) {
        return mcpErr(getting.$error);
      }

      return mcpText(JSON.stringify(getting));
    }
  );

  client.addTool(
    "gmail_list_threads",
    {
      title: "List threads",
      description: "Lists the threads in the user's GMail",
      inputSchema: LIST_INPUT_SCHEMA,
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ q, labelIds, includeSpamTrash, maxResults }) => {
      const getting = await google.gmailGetThreads(
        filterUndefined({
          q,
          userId: "me",
          labelIds,
          includeSpamTrash,
          maxResults,
        })
      );
      if (!ok(getting)) {
        return mcpErr(getting.$error);
      }

      return mcpText(JSON.stringify(getting));
    }
  );

  client.addTool(
    "gmail_send_message",
    {
      title: "Send email",
      description: "Sends an email message on user's behalf using their GMail",
      inputSchema: SEND_INPUT_SCHEMA,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      const raw = createMessage(args);

      const sending = await google.gmailSendMessage(
        {
          userId: "me",
        },
        { raw }
      );
      if (!ok(sending)) {
        return mcpErr(sending.$error);
      }
      if (sending.status !== 200) {
        return mcpErr(sending.statusText || "Unable to send GMail message");
      }
      return mcpText("Message Sent successfully");
    }
  );

  client.addTool(
    "gmail_create_draft",
    {
      title: "Create draft",
      description: "Creates a draft of an email message in the user's GMail",
      inputSchema: SEND_INPUT_SCHEMA,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      const raw = createMessage(args);

      const sending = await google.gmailCreateDraft(
        {
          userId: "me",
        },
        { message: { raw } }
      );
      if (!ok(sending)) {
        return mcpErr(sending.$error);
      }
      if (sending.status !== 200) {
        return mcpErr(sending.statusText || "Unable to create Gmail draft");
      }
      return mcpText("Draft created successfully");
    }
  );

  return client;
}

function createMessage({ to, cc, bcc, subject, content }: MessageComponents) {
  const message = createMimeMessage();
  message.setSender("me");
  message.setSubject(subject);
  message.setTo(to);
  message.setCc(cc);
  message.setBcc(bcc);
  message.addMessage({
    contentType: "text/plain",
    data: content,
  });

  return message.asEncoded();
}
