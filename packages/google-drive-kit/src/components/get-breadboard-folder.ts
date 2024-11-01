/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  board,
  input,
  object,
  outputNode,
} from "@breadboard-ai/build";
import { cast, code, fetch } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { headers } from "../internal/headers.js";
import { fileListType, fileType } from "../types.js";

const folderName = input({
  title: "Name",
  description:
    'The name of the folder. "Breadboard" will be used if not specified.',
  type: annotate("string", { behavior: ["config"] }),
  default: "Breadboard",
});

const createQuery = code(
  {
    $metadata: {
      title: "Create List Query",
      description: "Creating a query to list the files.",
    },
  },
  { query: "string" },
  () => {
    return {
      query: `appProperties has { key = 'breadboard' and value = 'root' } and trashed = false`,
    };
  }
);

const listFilesUrl = urlTemplate({
  // https://developers.google.com/drive/api/reference/rest/v3/files/list
  template: "https://www.googleapis.com/drive/v3/files?q={query}",
  query: createQuery.outputs.query,
});

const listFilesResponse = cast(
  fetch({
    $metadata: {
      title: "List Files",
      description: "Calling the List Files API",
    },
    url: listFilesUrl,
    headers,
  }),
  fileListType
);

const routeFromListFiles = code(
  {
    $metadata: {
      title: "Route from List",
      description: "Deciding whether to create a new folder",
    },
    response: listFilesResponse,
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
    $metadata: {
      title: "Make Body",
      description: 'Make body of the "Create Folder" API call',
    },
    notFound: routeFromListFiles.outputs.notFound,
    folderName,
  },
  { body: object({}) },
  ({ folderName }) => {
    folderName ??= "Breadboard";

    return {
      body: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: {
          breadboard: "root",
        },
      },
    };
  }
);

const existsOutput = outputNode({
  $metadata: {
    title: "Get Folder Output",
    description: "Outputting ID of the existing folder",
  },
  id: routeFromListFiles.outputs.id,
});

const createFolderResponse = cast(
  fetch({
    $metadata: {
      title: "Create Folder",
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

const newOutput = outputNode({
  $metadata: {
    title: "Create Folder Output",
    description: "Outputtting ID of the newly created folder",
  },
  id: retrieveId.outputs.id,
});

const createBreadboardFolder = board({
  title: "Get Breadboard Folder",
  description:
    'Gets (or creates if doesn\'t exist) a dedicated "Breadboard" folder in Google Drive. This folder can be used for story various Breadboard-specifc assets and boards.',
  version: "0.1.0",
  metadata: {
    icon: "google-drive",
  },
  inputs: { folderName },
  outputs: [existsOutput, newOutput],
});

export default createBreadboardFolder;
