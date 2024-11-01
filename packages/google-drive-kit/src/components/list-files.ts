/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  annotate,
  board,
  input,
  optionalEdge,
  output,
} from "@breadboard-ai/build";
import { cast, fetch, unnest } from "@google-labs/core-kit";
import { urlTemplate } from "@google-labs/template-kit";
import { headers } from "../internal/headers.js";
import { fileListType } from "../types.js";

const query = input({
  title: "Query",
  description: `A Google Drive search query.
See https://developers.google.com/drive/api/guides/search-files for details.`,
  type: annotate("string", { behavior: ["google-drive-query"] }),
  examples: [
    "'<folder id>' in parents",
    "name = 'hello'",
    "fullText contains 'hello'",
    "mimeType = 'application/vnd.google-apps.folder'",
    "sharedWithMe and name contains 'hello'",
  ],
});

const url = urlTemplate({
  // https://developers.google.com/drive/api/reference/rest/v3/files/list
  template: "https://www.googleapis.com/drive/v3/files?q={query}",
  query,
});

const rawResponse = fetch({ url, headers });
const response = cast(rawResponse, fileListType);
const { files, incompleteSearch, nextPageToken } = unnest(response);

export const listFiles = board({
  id: "listFiles",
  title: "List Files",
  description:
    "List files in Google Drive.\n\nSee https://developers.google.com/drive/api/guides/search-files for more details.",
  metadata: {
    icon: "google-drive",
  },
  inputs: { query },
  outputs: {
    files: output(files, {
      title: "Files",
      description: `The list of files. If nextPageToken is populated, then this list may be incomplete and an additional page of results should be fetched.\n\nSee https://developers.google.com/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.files`,
    }),
    incompleteSearch: output(incompleteSearch, {
      title: "Incomplete Search",
      description: `Whether the search process was incomplete. If true, then some search results might be missing, since all documents were not searched. This can occur when searching multiple drives with the 'allDrives' corpora, but all corpora couldn't be searched. When this happens, it's suggested that clients narrow their query by choosing a different corpus such as 'user' or 'drive'.\n\nSee https://developers.google.com/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.incomplete_search`,
    }),
    nextPageToken: output(optionalEdge(nextPageToken), {
      title: "Next Page Token",
      description: `The page token for the next page of files. This will be absent if the end of the files list has been reached. If the token is rejected for any reason, it should be discarded, and pagination should be restarted from the first page of results. The page token is typically valid for several hours. However, if new items are added or removed, your expected results might differ.\n\nSee https://developers.google.com/drive/api/reference/rest/v3/files/list#body.FileList.FIELDS.next_page_token`,
    }),
  },
});

export default listFiles;
