/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  converge,
  input,
  object,
  output,
} from "@breadboard-ai/build";
import { cast, code, fetch, passthrough } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { headers, multipartHeaders } from "../internal/headers.js";
import { fileListType, fileType } from "../types.js";

function describe(title: string, description: string = title) {
  return {
    $metadata: { title, description },
  };
}

const SAVES_FOLDER_NAME = "saved";

const context = input({
  title: "Context in",
  description: "The conversation context to save to Google Drive.",
  type: array(annotate(object({}), { behavior: ["llm-content"] })),
});

const rootId = input({
  title: "Root ID",
  description:
    'The Drive id of the Breadboard folder that is used as root for storing data. Use "Get Breadboard Folder" component to obtain it',
  type: "string",
});

const key = input({
  title: "Key",
  description:
    "A unique key associated with this context, used to later load it from Google Drive.",
  type: annotate("string", { behavior: ["config"] }),
});

const findSavesQuery = code(
  {
    ...describe(
      'Query "Saves" Folder',
      `Making a query to find the "${SAVES_FOLDER_NAME}" folder`
    ),
    rootId,
  },
  { query: "string" },
  ({ rootId }) => {
    return {
      query: `"${rootId}" in parents and mimeType = "application/vnd.google-apps.folder" and name = "saved" and trashed = false`,
    };
  }
);

const findSavesUrl = urlTemplate({
  ...describe("Make Find Saves URL Template"),
  template: "https://www.googleapis.com/drive/v3/files?q={query}",
  query: findSavesQuery.outputs.query,
});

const findSavesResponse = cast(
  fetch({
    ...describe(`Search for the "${SAVES_FOLDER_NAME}" folder`),
    url: findSavesUrl,
    headers,
  }),
  fileListType
);

const routeFromListFiles = code(
  {
    ...describe("Route from List", "Deciding whether to create a new folder"),
    response: findSavesResponse,
  },
  {
    id: { type: "string", optional: true },
    notFound: { type: "boolean", optional: true },
  },
  ({ response }) => {
    const first = response.files?.at(0);
    if (!first) {
      return { notFound: true };
    }
    return { id: first.id };
  }
);

const buildCreateBody = code(
  {
    ...describe(`Make request body to create ${SAVES_FOLDER_NAME} folder`),
    notFound: routeFromListFiles.outputs.notFound,
    folderName: SAVES_FOLDER_NAME,
    rootId,
  },
  { body: object({}) },
  ({ folderName, rootId }) => {
    return {
      body: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootId],
      },
    };
  }
);

const createFolderResponse = cast(
  fetch({
    $metadata: {
      title: `Create "${SAVES_FOLDER_NAME}" Folder`,
      description: "Calling the File Create API",
    },
    url: "https://www.googleapis.com/drive/v3/files",
    method: "POST",
    headers,
    body: buildCreateBody.outputs.body,
  }).outputs.response,
  fileType
);

const retrieveId = code(
  {
    $metadata: {
      title: "Get ID",
      description: "Retrieving ID of the newly created folder",
    },
    createFolderResponse,
  },
  { id: "string" },
  ({ createFolderResponse }) => {
    return { id: createFolderResponse.id };
  }
);

const makeSaveContextBody = code(
  {
    ...describe("Make the request body to save context"),
    id: converge(retrieveId.outputs.id, routeFromListFiles.outputs.id),
    key,
    context,
  },
  { body: "string" },
  ({ id, key, context }) => {
    const boundary = "BBBBBBBBBBB";
    const metadata = {
      name: key,
      mimeType: "application/json",
      parents: [id],
    };
    const multipartBody = `--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(metadata, null, 2)}
--${boundary}
Content-Type: application/json; charset=UTF-8

${JSON.stringify(context, null, 2)}
--${boundary}--`;
    return {
      body: multipartBody,
    };
  }
);

const saveContextResponse = cast(
  fetch({
    $metadata: {
      title: `Save context`,
      description: "Calling the File Create API",
    },
    url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    method: "POST",
    headers: multipartHeaders,
    body: makeSaveContextBody.outputs.body,
  }).outputs.response,
  fileType
);

const pass = passthrough({
  context,
  saveContextResponse,
});

export default board({
  id: "saveContextToDrive",
  title: "Save Context To Drive",
  description: "Saves LLM Conversation Context to Google Drive.",
  metadata: {
    icon: "google-drive",
  },
  inputs: { context, key, breadboardFolderId: rootId },
  outputs: {
    context: output(pass.outputs.context, {
      title: "Context out",
      description: "LLM Conversation Context that was passed in",
    }),
  },
});
