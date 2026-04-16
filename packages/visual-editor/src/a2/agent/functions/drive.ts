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

const GOOGLE_DRIVE_MCP_PREFIX =
  CLIENT_DEPLOYMENT_CONFIG.GOOGLE_DRIVE_MCP_ENDPOINT ?? "";

export { getDriveFunctionGroup };

export type DriveFunctionArgs = {
  moduleArgs: A2ModuleArgs;
  taskTreeManager: TaskTreeManager;
};

function getDriveFunctionGroup(args: DriveFunctionArgs): FunctionGroup {
  const { moduleArgs } = args;

  const declarations: FunctionDeclaration[] = [
    {
      name: "drivemcp_create_file",
      description: "Call this tool to create or upload a File to Google Drive.\nIf uploading a file, the content needs to be base64 encoded into the `content` field regardless of the mimetype of the file being uploaded.\nReturns a single File object upon successful creation.The following Google Drive first-party mime types can be created without providing content: - `application/vnd.google-apps.document` - `application/vnd.google-apps.spreadsheet` - `application/vnd.google-apps.presentation`By default, the following conversions will be made for the following mime types: - `text/plain` to `application/vnd.google-apps.document` - `text/csv` to `application/vnd.google-apps.spreadsheet`To disable conversions for first-party mime types, set `disable_conversion_to_google_type` to true.Folders can be created by setting the mime type to `application/vnd.google-apps.folder`.\n",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "The content of the file encoded as base64." },
          disableConversionToGoogleType: { type: "boolean", description: "If true, the file will not be converted to a Google type." },
          mimeType: { type: "string", description: "The mime type of the file to upload." },
          parentId: { type: "string", description: "The parent id of the file." },
          title: { type: "string", description: "The title of the file." },
        },
      },
    },
    {
      name: "drivemcp_download_file_content",
      description: "Call this tool to download the content of a Drive file as raw binary data (bytes).\nIf the file is a Google Drive first-party mime type, the `exportMimeType` field is required and will determine the format of the downloaded file.If the file is not found, try using other tools like `search_files` to find the file the user is requesting.If the user wants a natural language representation of their Drive content, use the `read_file_content` tool (`read_file_content` should be smaller and easier to parse).\n",
      parameters: {
        type: "object",
        properties: {
          exportMimeType: { type: "string", description: "Optional. For Google native files, the MIME type to export the file to." },
          fileId: { type: "string", description: "Required. The ID of the file to retrieve." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drivemcp_get_file_metadata",
      description: "Call this tool to find general metadata about a user's Drive file.\nIf the file is not found, try using other tools like `search_files` to find the file the user is requesting.\n",
      parameters: {
        type: "object",
        properties: {
          excludeContentSnippets: { type: "boolean", description: "If true, the content snippet will be excluded from the response." },
          fileId: { type: "string", description: "Required. The ID of the file to retrieve." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drivemcp_get_file_permissions",
      description: "Call this tool to list the permissions of a Drive File.\n",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "Required. The ID of the file to get permissions for." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drivemcp_list_recent_files",
      description: "Call this tool to find recent files for a user specified a sort order. Default sort order is `recency`.\nSupported sort orders are: - `recency`: The most recent timestamp from the file's date-time fields. - `lastModified`: The last time the file was modified by anyone. - `lastModifiedByMe`: The last time the file was modified by the user.The default page size is 10. Utilize `next_page_token` to paginate through the results.\n",
      parameters: {
        type: "object",
        properties: {
          excludeContentSnippets: { type: "boolean", description: "If true, the content snippet will be excluded." },
          orderBy: { type: "string", description: "The sort order for the files." },
          pageSize: { type: "integer", description: "The maximum number of files to return." },
          pageToken: { type: "string", description: "The page token to use for pagination." },
        },
      },
    },
    {
      name: "drivemcp_read_file_content",
      description: "Call this tool to fetch a natural language representation of a Drive file.\nThe file content may be incomplete for very large files. The text representation will change\nover time, so don't make assumptions about the particular format of the text returned by\nthis tool.\nSupported Mime Types: - `application/vnd.google-apps.document` - `application/vnd.google-apps.presentation` - `application/vnd.google-apps.spreadsheet` - `application/pdf` - `application/msword` - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` - `application/vnd.openxmlformats-officedocument.presentationml.presentation` - `application/vnd.oasis.opendocument.spreadsheet` - `application/vnd.oasis.opendocument.presentation` - `application/x-vnd.oasis.opendocument.text` - `image/png` - `image/jpeg` - `image/jpg`If the file is not found, try using other tools like `search_files` to find the file the user is requesting using keywords.\n",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "Required. The ID of the file to retrieve." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drivemcp_search_files",
      description: "Call this tool to search for Drive files given a structured query.\n The `query` field requires the use of query search operators.\n  A query string contains the following three parts: `query_term operator values` where:  - `query_term` is the query term or field to search upon.  - `operator` specifies the condition for the query term.  - `values` are the specific values to use to filter your search results.  ## Query Terms  The following table lists valid query terms with their descriptions:  | Query Term       | Valid operators                 | Usage                                                                                                                                                                  |\n  | ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n  | `title`          | `contains`, `=`, `!=`           | Title of the file. Surround with single quotes (`'`). Escape single quotes in queries with `\\'`, such as `'Valentine\\'s Day'`.                                         |\n  | `fullText`       | `contains`                      | Whether the `title` or text in the file's content matches. Surround with single quotes (`'`). Escape single quotes in queries with `\\'`, such as `'Valentine\\'s Day'`. |\n  | `mimeType`       | `contains`, `=`, `!=`           | MIME type of the file. Surround with single quotes (`'`). Escape single quotes in queries with `\\'`, such as `'Valentine\\'s Day'`.                                     |\n  | `modifiedTime`   | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date of the last file modification. RFC 3339 format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`. Fields of type `date` are not comparable.           |\n  | `viewedByMeTime` | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date that the user last viewed a file. RFC 3339 format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`. Fields of type `date` are not comparable.        |\n  | `parentId`       | `=`, `!=`                       | Whether the parent equals the specified ID. `root` can be used to specify the user's \"My Drive\" that functions as their primary hierarchy.                            |\n  | `owner`          | `=`, `!=`                       | User who owns the file. `me` can be used to specify the user that is making the request.                                                                                |\n  | `sharedWithMe`   | `=`, `!=`                       | Files that are in the user's \"Shared with me\" collection. All file users are in the file's Access Control List (ACL). Can be either `true` or `false`.               |\n  | `createdTime`    | `<=`, `<`, `=`, `!=`, `>`, `>=` | Date when the file was created. Use RFC 3339 format, default time zone is UTC, such as `2012-06-04T12:00:00-08:00`.                                                    |\n  ## Query Operators  The following table lists valid query operators:  | Operator   | Usage                                                         |  | ---------- | ------------------------------------------------------------- |  | `contains` | The content of one string is present in the other.            |  | `=`        | The content of a string or boolean is equal to the other.     |  | `!=`       | The content of a string or boolean is not equal to the other. |  | `<`        | A value is less than another.                                 |  | `<=`       | A value is less than or equal to another.                     |  | `>`        | A value is greater than another.                              |  | `>=`       | A value is greater than or equal to another.                  |  | `in`       | An element is contained within a collection.                  |  | `and`      | Return items that match both queries.                         |  | `or`       | Return items that match either query.                         |  | `not`      | Negates a search query.                                       |  | `has`      | A collection contains an element matching the parameters.     |  Some examples of queries include:  - `title contains 'hello' and title contains 'goodbye'`  - `modifiedTime > '2024-01-01T00:00:00Z' and (mimeType contains 'image/' or mimeType contains 'video/')\`  - `parentId = '1234567'`  - `fullText contains 'hello'`  - `owner = 'test@example.org'`  - `sharedWithMe = true`  - `owner = 'me'` (for files owned by the user)Utilize `next_page_token` to paginate through the results. An empty response indicates that there are either no results or no more results to return.\n",
      parameters: {
        type: "object",
        properties: {
          excludeContentSnippets: { type: "boolean", description: "If true, the content snippet will be excluded." },
          pageSize: { type: "integer", description: "The maximum number of files to return in each page." },
          pageToken: { type: "string", description: "The page token to use for pagination." },
          query: { type: "string", description: "The search query." },
        },
      },
    },
    {
      name: "drivemcp_update_file",
      description: "Call this tool to update the metadata of a Google Drive file.\nIf the file is not found, try using other tools like `search_files` to find the file the user is attempting to update.\n",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "Required. The ID of the file to update." },
          title: { type: "string", description: "The updated title of the file." },
        },
        required: ["fileId"],
      },
    },
  ];

  return assembleFunctionGroup(declarations, {}, "", {
    drivemcp_create_file: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("create_file", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_download_file_content: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("download_file_content", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_get_file_metadata: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("get_file_metadata", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_get_file_permissions: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("get_file_permissions", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_list_recent_files: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("list_recent_files", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_read_file_content: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("read_file_content", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_search_files: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("search_files", inputs);
      } finally {
        await client.close();
      }
    },
    drivemcp_update_file: async (inputs: any) => {
      const client = new McpClient(moduleArgs.fetchWithCreds, new URL("/mcp", GOOGLE_DRIVE_MCP_PREFIX));
      await client.connect();
      try {
        return await client.callTool("update_file", inputs);
      } finally {
        await client.close();
      }
    },
  });
}
