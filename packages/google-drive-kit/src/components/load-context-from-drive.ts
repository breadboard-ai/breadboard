/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  array,
  board,
  input,
  object,
  output,
  outputNode,
} from "@breadboard-ai/build";
import { cast, code, fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { headers } from "../internal/headers.js";
import { fileListType } from "../types.js";

function describe(title: string, description: string = title) {
  return {
    $metadata: { title, description },
  };
}

const SAVES_FOLDER_NAME = "saved";

const key = input({
  title: "Key",
  description:
    "A unique key that was used to save LLM Conversation context to Google Drive.",
  type: annotate("string", { behavior: ["config"] }),
});

const rootId = input({
  title: "Root ID",
  description:
    'The Drive id of the Breadboard folder that is used as root for storing data. Use "Get Breadboard Folder" component to obtain it',
  type: "string",
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
  ...describe('Make Find "saved" folder URL template'),
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
    ...describe("Route from List", "Deciding if to load or skip"),
    response: findSavesResponse,
    key,
  },
  {
    query: { type: "string", optional: true },
    context: {
      type: array(
        annotate(object({}, "unknown"), {
          behavior: ["llm-content"],
        })
      ),
      optional: true,
    },
  },
  ({ response, key }) => {
    const first = response.files?.at(0);
    if (!first) {
      return { context: [] };
    }
    return {
      query: `"${first.id}" in parents and mimeType = "application/json" and name = "${key}" and trashed = false`,
    };
  }
);

const findSavedFileUrl = urlTemplate({
  ...describe("Make Find saved file URL template"),
  template:
    "https://www.googleapis.com/drive/v3/files?q={query}&orderBy=createdTime+desc",
  query: routeFromListFiles.outputs.query,
});

const findSavedFileResponse = cast(
  fetch({
    ...describe(`Search for the saved file`),
    url: findSavedFileUrl,
    headers,
  }),
  fileListType
);

const routeFromListSavedFiles = code(
  {
    ...describe("Route from List of saved files"),
    response: findSavedFileResponse,
  },
  {
    id: { type: "string", optional: true },
    context: {
      type: array(
        annotate(object({}, "unknown"), {
          behavior: ["llm-content"],
        })
      ),
      optional: true,
    },
  },
  ({ response }) => {
    const first = response.files?.at(0);
    if (!first) {
      return { context: [] };
    }
    return { id: first.id };
  }
);

const getFileUrl = urlTemplate({
  ...describe("Make template to retrieve saved file"),
  id: routeFromListSavedFiles.outputs.id,
  template: "https://www.googleapis.com/drive/v3/files/{id}?alt=media",
});

const getFileResponse = cast(
  fetch({
    ...describe("Get saved file"),
    url: getFileUrl,
    headers,
  }),
  array(
    annotate(object({}, "unknown"), {
      behavior: ["llm-content"],
    })
  )
);

const notFoundOutput = outputNode({
  ...describe("Breadboard root not found"),
  context: output(routeFromListFiles.outputs.context, { title: "Context out" }),
});

const savedFileNotFoundOutput = outputNode({
  ...describe("Saved file not found"),
  context: output(routeFromListSavedFiles.outputs.context, {
    title: "Context out",
  }),
});

const loadedOutput = outputNode({
  ...describe("Output loaded context"),
  context: output(getFileResponse, { title: "Context out" }),
});

export default board({
  id: "loadContextFromDrive",
  metadata: {
    title: "Load Context from Drive",
    description:
      "Loads previously saved LLM Conversation context from Google Drive",
    icon: "google-drive",
  },
  inputs: { rootId, key },
  outputs: [notFoundOutput, savedFileNotFoundOutput, loadedOutput],
});
