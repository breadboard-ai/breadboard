/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  FindUserOpalFolderResult,
  ListOpalFileItem,
  ListUserOpalsResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { GOOGLE_DRIVE_FILES_API_PREFIX } from "@breadboard-ai/types/canonical-endpoints.js";

export { findUserOpalFolder, listUserOpals };

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder";
export const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";

export const IS_SHAREABLE_COPY_PROPERTY = "isShareableCopy";

async function findUserOpalFolder(
  userFolderName: string,
  accessToken: string
): Promise<FindUserOpalFolderResult> {
  const query = `name=${quote(userFolderName)}
  and mimeType="${GOOGLE_DRIVE_FOLDER_MIME_TYPE}"
  and trashed=false`;

  const url = new URL(GOOGLE_DRIVE_FILES_API_PREFIX);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id, mimeType)");
  url.searchParams.set("orderBy", "createdTime desc");

  try {
    let { files } = (await fetchWithRetry(url, {
      // Closure munges the header key so it needs to be quoted.
      // But prettier likes to remove the quotes.
      // prettier-ignore
      headers: { "Authorization": `Bearer ${accessToken}` },
    }).then((r) => r.json())) as {
      files: { id: string; mimeType: string }[];
    };
    // This shouldn't be required based on the query above, but for some reason
    // the TestGaia drive endpoint doesn't seem to respect the mimeType query
    files = files.filter((f) => f.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE);
    if (files.length > 0) {
      if (files.length > 1) {
        console.warn(
          "[Google Drive] Multiple candidate root folders found," +
            " picking the first created one arbitrarily:",
          files
        );
      }
      const id = files[0]!.id;
      console.log("[Google Drive] Found existing root folder", id);
      return { ok: true, id };
    }
    return { ok: false, error: "No root folder found" };
  } catch {
    return { ok: false, error: "Failed to find root folder" };
  }
}

async function listUserOpals(
  accessToken: string,
  isTestApi: boolean
): Promise<ListUserOpalsResult> {
  const fields = [
    "id",
    "name",
    "modifiedTime",
    "properties",
    "appProperties",
    "isAppAuthorized",
  ];
  const query = `mimeType = ${quote(GRAPH_MIME_TYPE)}
and trashed = false
and not properties has {
  key = ${quote(IS_SHAREABLE_COPY_PROPERTY)}
  and value = "true"
}
and 'me' in owners
  `;
  const url = new URL(GOOGLE_DRIVE_FILES_API_PREFIX);
  url.searchParams.set("q", query);
  url.searchParams.set("fields", `files(${fields.join(",")})`);
  url.searchParams.set("orderBy", "modifiedTime desc");

  try {
    let { files } = (await fetchWithRetry(url, {
      // Closure munges the header key so it needs to be quoted.
      // But prettier likes to remove the quotes.
      // prettier-ignore
      headers: { "Authorization": `Bearer ${accessToken}` },
    }).then((r) => r.json())) as {
      files: ListOpalFileItem[];
    };

    files = files.filter(
      (file) =>
        // Filter down to graphs created by whatever the current OAuth app is.
        // Otherwise, graphs from different OAuth apps will appear in this list
        // too, and if they are selected, we won't be able to edit them. Note
        // there is no way to do this in the query itself.
        file.isAppAuthorized ||
        // Note when running on testGaia, isAppAuthorized seems to always be false
        // so just allow all files in that case (they should all be from the test
        // client anyway)
        isTestApi
    );

    return { ok: true, files };
  } catch {
    return { ok: false, error: "Failed to list opals" };
  }
}

function quote(value: string) {
  return `'${value.replace(/'/g, "\\'")}'`;
}

/** Delay between GDrive API retries. */
const RETRY_MS = 200;

/** Retries fetch() calls until status is not an internal server error. */
async function fetchWithRetry(
  input: string | Request | URL,
  init?: RequestInit,
  numAttempts: 1 | 2 | 3 | 4 | 5 = 3
): Promise<Response> {
  function shouldRetry(response: Response): boolean {
    return 500 <= response.status && response.status <= 599;
  }

  async function recursiveHelper(numAttemptsLeft: number): Promise<Response> {
    numAttemptsLeft -= 1;
    let response: Response | null = null;
    try {
      response = await fetch(input, init);
      if (shouldRetry(response)) {
        console.warn(
          `Error in fetch(${input}). Attempts left: ${numAttemptsLeft}/${numAttempts}. Response:`,
          response
        );
      } else {
        return response;
      }
    } catch (e) {
      console.warn(
        `Exception in fetch(${input}). Attempts left: ${numAttemptsLeft}/${numAttempts}`,
        e
      );
      // return "403 Forbidden" response, as this is likely a CORS error
      response = new Response(null, {
        status: 403,
      });
    }

    if (numAttemptsLeft <= 0) {
      return response;
    }

    return await new Promise((resolve) => {
      setTimeout(async () => {
        resolve(await recursiveHelper(numAttemptsLeft));
      }, RETRY_MS);
    });
  }

  return recursiveHelper(numAttempts);
}
