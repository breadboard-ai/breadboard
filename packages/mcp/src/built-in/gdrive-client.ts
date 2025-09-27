/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@types/gapi.client.drive-v3" />

import { z } from "zod";
import { BuiltInClient } from "../built-in-client.js";
import { McpBuiltInClient, TokenGetter } from "../types.js";
import { mcpErr, mcpResourceLink, mcpText } from "../utils.js";
import { Outcome } from "@breadboard-ai/types";
import { err, filterUndefined, ok } from "@breadboard-ai/utils";

export { createGdriveClient };

function createGdriveClient(tokenGetter: TokenGetter): McpBuiltInClient {
  const client = new BuiltInClient({
    name: "Google Drive",
    url: "builtin:gdrive",
  });

  client.addTool(
    "gdrive_list_files",
    {
      title: "List Drive files",
      description: `Lists the user's files in Google Drive. This method accepts the q parameter, which is a search query combining one or more search terms.

This method returns all files by default, including trashed files. If you don't want trashed files to appear in the list, use the trashed=false to remove trashed files from the results.`,
      inputSchema: {
        corpora: z
          .string()
          .describe(
            `Bodies of items (files or documents) to which the query applies. Supported bodies are:

"user"
"domain"
"drive"
"allDrives"
Prefer "user" or "drive" to "allDrives" for efficiency. By default, corpora is set to "user". However, this can change depending on the filter set through the "q" parameter.`
          )
          .optional(),
        driveId: z
          .string()
          .describe(
            `ID of the shared drive to search. Use it when the "corporate" is set to "drive"`
          )
          .optional(),
        includeItemsFromAllDrives: z
          .boolean()
          .describe(
            `Whether both My Drive and shared drive items should be included in results.

`
          )
          .optional(),
        orderBy: z
          .string()
          .describe(
            `A comma-separated list of sort keys. Valid keys are:

createdTime: When the file was created.
folder: The folder ID. This field is sorted using alphabetical ordering.
modifiedByMeTime: The last time the file was modified by the user.
modifiedTime: The last time the file was modified by anyone.
name: The name of the file. This field is sorted using alphabetical ordering, so 1, 12, 2, 22.
name_natural: The name of the file. This field is sorted using natural sort ordering, so 1, 2, 12, 22.
quotaBytesUsed: The number of storage quota bytes used by the file.
recency: The most recent timestamp from the file's date-time fields.
sharedWithMeTime: When the file was shared with the user, if applicable.
starred: Whether the user has starred the file.
viewedByMeTime: The last time the file was viewed by the user.

Each key sorts ascending by default, but can be reversed with the desc modifier. Example usage: folder,modifiedTime desc,name.`
          )
          .optional(),
        q: z.string()
          .describe(`A query for filtering the file results. The query has has three parts: \`query_term operator values\`.

### Query Terms
These are the fields you can search on. Here are the most common ones:

| Query Term     | Description                                                                                             |
|----------------|---------------------------------------------------------------------------------------------------------|
| \`name\`         | The name or title of the file.                                                                          |
| \`fullText\`     | The file's content, name, description, and other metadata.                                              |
| \`mimeType\`     | The type of the file. See the "Common MIME Types" section below.                                        |
| \`modifiedTime\` | The last modification date. Must be in RFC 3339 format (e.g., \`'2025-09-26T12:00:00'\`).                  |
| \`trashed\`      | A boolean (\`true\` or \`false\`) indicating if the file is in the trash.                                   |
| \`starred\`      | A boolean (\`true\` or \`false\`) indicating if the file is starred.                                        |
| \`parents\`      | The ID of the parent folder. Used with the \`in\` operator (e.g., \`'folder_id' in parents\`).               |
| \`owners\`       | The email address of the file's owner. Used with the \`in\` operator (e.g., \`'user@example.com' in owners\`). |
| \`sharedWithMe\` | A boolean (\`true\` or \`false\`). Useful for finding files in the "Shared with me" view.                   |
| \`writers\`      | The email address of a user with write permission. Used with \`in\` (e.g., \`'user@example.com' in writers\`).|

### Query Operators
These specify the condition for the query term.

| Operator    | Usage                                                              |
|-------------|--------------------------------------------------------------------|
| \`contains\`  | Checks if a string value is present in the query term.             |
| \`=\`         | Checks for an exact match.                                         |
| \`!=\`        | Checks for non-match.                                              |
| \`>\`, \`<\`, \`>=\`, \`<=\` | Compares date or numeric values.                                   |
| \`in\`        | Checks if a value is in a collection (like \`parents\` or \`owners\`). |
| \`and\`       | Combines multiple query terms; all must be true.                   |
| \`or\`        | Combines multiple query terms; any can be true.                    |
| \`not\`       | Negates a search query.                                            |

### Common MIME Types
Use these values with the \`mimeType\` query term to find specific file types.

| MIME Type                                    | Description             |
|----------------------------------------------|-------------------------|
| \`application/vnd.google-apps.folder\`         | Google Drive Folder     |
| \`application/vnd.google-apps.document\`       | Google Docs             |
| \`application/vnd.google-apps.spreadsheet\`    | Google Sheets           |
| \`application/vnd.google-apps.presentation\`   | Google Slides           |
| \`application/pdf\`                            | PDF File                |
| \`image/jpeg\`                                 | JPEG Image              |
| \`video/mp4\`                                  | MP4 Video               |

You can also use partial matches like \`mimeType contains 'image/'\` to find all image types.

---

### Important Rules & Behavior

1.  **Quoting:** String values, emails, and dates **must be enclosed in single quotes** (e.g., \`name = 'My Report'\`).
2.  **Escaping Characters:** To search for a single quote \`'\` or a backslash \`\\\` in a name, you must escape it with a backslash. Example: \`name = 'quinn\\'s paper\\essay'\`.
3.  **Operator \`contains\`:**
    * For \`name\`, it performs **prefix matching only**. A search for \`name contains 'hello'\` will find "helloworld.txt" but not "worldhello.txt".
    * For \`fullText\`, it matches **entire string tokens**. To match an exact phrase, enclose the phrase in double quotes inside the single quotes (e.g., \`fullText contains '"hello world"'\`).
4.  **Combining Terms:** You can combine multiple terms with \`and\` or \`or\`. Use parentheses \`()\` to group logic. Example: \`(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/pdf') and trashed = false\`.
5.  **Negation:** The \`not\` operator applies to the term immediately following it. Example: \`not name contains 'draft'\`.

---

### Examples

| Goal                                                               | Example \`q\` value                                                                                         |
|--------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| Find a file named "Project Alpha Budget"                           | \`name = 'Project Alpha Budget'\`                                                                           |
| Find all Google Docs                                               | \`mimeType = 'application/vnd.google-apps.document'\`                                                       |
| Find files containing the exact phrase "meeting notes for Q3"      | \`fullText contains '"meeting notes for Q3"'\`                                                              |
| Find all non-folder files modified since September 1, 2025         | \`modifiedTime > '2025-09-01T00:00:00' and mimeType != 'application/vnd.google-apps.folder'\`               |
| Find presentations that are not in the trash                       | \`mimeType = 'application/vnd.google-apps.presentation' and trashed = false\`                               |
| Find files owned by 'ceo@example.com'                              | \`'ceo@example.com' in owners\`                                                                             |
| Find files inside a folder with ID \`123abcXYZ\`                     | \`'123abcXYZ' in parents\`                                                                                  |
| Find PDF or DOC files shared with me                               | \`sharedWithMe = true and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document')\` |
            `),
      },
    },
    async ({ corpora, driveId, includeItemsFromAllDrives, orderBy, q }) => {
      try {
        const drive = await loadDriveApi(tokenGetter);
        if (!ok(drive)) {
          return mcpErr(drive.$error);
        }

        const listing = await drive.files.list(
          filterUndefined({
            corpora,
            driveId,
            q,
            includeItemsFromAllDrives,
            orderBy,
          })
        );
        if (listing.status !== 200) {
          return mcpErr(
            listing.statusText || "Unable to list Google Drive files"
          );
        }
        return mcpText(JSON.stringify(listing.result));
      } catch {
        return mcpErr(`Unable to list Google Drive files`);
      }
    }
  );

  client.addTool(
    "gdrive_get_file",
    {
      title: "Get Drive file",
      description: "Loads the file from Google Drive",
      inputSchema: {
        fileId: z.string().describe(`The Drive ID of the file`),
      },
    },
    async ({ fileId }) => {
      try {
        const drive = await loadDriveApi(tokenGetter);
        if (!ok(drive)) {
          return mcpErr(drive.$error);
        }

        // Get file type
        const gettingMetadata = await drive.files.get({
          fileId,
          fields: "mimeType,name",
        });
        if (gettingMetadata.status !== 200) {
          return mcpErr(
            gettingMetadata.statusText ||
              "Unable to load file metadata from Google Drive"
          );
        }
        const { mimeType, name } = gettingMetadata.result;
        if (!mimeType || !name) {
          return mcpErr(
            gettingMetadata.statusText ||
              "Unable to load file metadata from Google Drive"
          );
        }

        if (mimeType!.startsWith("application/vnd.google-apps.")) {
          const exporting = await drive.files.export({
            fileId,
            mimeType: "text/plain",
          });
          if (exporting.status !== 200) {
            return mcpErr(
              exporting.statusText || "Unable to export file from Google Drive"
            );
          }
          const blob = new Blob([exporting.body], { type: "text/plain" });
          const url = window.URL.createObjectURL(blob);
          return mcpResourceLink(name!, url);
        } else {
          const downloading = await drive.files.get({
            fileId,
            alt: "media",
          });
          if (downloading.status !== 200) {
            return mcpErr(
              downloading.statusText ||
                "Unable to download file from Google Drive"
            );
          }
          const blob = new Blob([downloading.body], { type: mimeType });
          const url = window.URL.createObjectURL(blob);
          return mcpResourceLink(name!, url);
        }
      } catch {
        return mcpErr(`Unable to load file from Google Drive`);
      }
    }
  );

  return client;
}

async function loadDriveApi(
  tokenGetter: TokenGetter
): Promise<Outcome<typeof gapi.client.drive>> {
  if (!globalThis.gapi) {
    return err("GAPI is not loaded, unable to load Drive API");
  }
  if (!gapi.client) {
    await new Promise((resolve) => gapi.load("client", resolve));
  }
  const access_token = await tokenGetter([
    "https://www.googleapis.com/auth/drive.readonly",
  ]);
  if (!ok(access_token)) {
    return err(access_token.$error);
  }
  gapi.client.setToken({ access_token });
  if (!gapi.client.drive) {
    await gapi.client.load(
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
    );
  }
  return gapi.client.drive;
}
