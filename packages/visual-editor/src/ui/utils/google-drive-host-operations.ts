/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GOOGLE_DRIVE_FILES_API_PREFIX } from "@breadboard-ai/types/canonical-endpoints.js";
import type {
  FindUserOpalFolderResult,
  GetDriveCollectorFileResult,
  ListDriveFileItem,
  ListUserOpalsResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";
import { fetchWithRetry } from "@breadboard-ai/utils/fetch-with-retry.js";

export { findUserOpalFolder, listUserOpals, getDriveCollectorFile };

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder";
export const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";

export const IS_SHAREABLE_COPY_PROPERTY = "isShareableCopy";

const DOC_MIME_TYPE = "application/vnd.google-apps.document";
const SHEETS_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
const SLIDES_MIME_TYPE = "application/vnd.google-apps.presentation";

type DriveErrorResponse = {
  error: {
    message: string;
  };
};

type DriveFileItem = {
  mimeType: string;
} & ListDriveFileItem;

type DriveListFilesResponse =
  | {
      files: DriveFileItem[];
    }
  | DriveErrorResponse;

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
    const response = await listFiles(accessToken, url);
    if ("error" in response) {
      return { ok: false, error: response.error.message };
    }
    // This shouldn't be required based on the query above, but for some reason
    // the TestGaia drive endpoint doesn't seem to respect the mimeType query
    const files = response.files.filter(
      (f) => f.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
    );
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
  } catch (e) {
    console.error("Failed to find root folder", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to find root folder",
    };
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
    const response = await listFiles(accessToken, url);
    if ("error" in response) {
      return { ok: false, error: response.error.message };
    }
    const files = response.files.filter(
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
  } catch (e) {
    console.error("Failed to list opals", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to list opals",
    };
  }
}

async function getDriveCollectorFile(
  accessToken: string,
  mimeType: string,
  connectorId: string,
  graphId: string
): Promise<GetDriveCollectorFileResult> {
  const fileKey = `${getTypeKey(mimeType)}${connectorId}${graphId}`;
  const query = `appProperties has { key = 'google-drive-connector' and value = '${fileKey}' } and trashed = false`;
  const url = new URL(GOOGLE_DRIVE_FILES_API_PREFIX);
  url.searchParams.set("q", query);

  try {
    const response = await listFiles(accessToken, url);
    if ("error" in response) {
      return { ok: false, error: response.error.message };
    }
    const files = response.files;
    if (files.length > 0) {
      return { ok: true, id: files[0]!.id };
    }
    return { ok: true, id: null };
  } catch (e) {
    console.error("Failed to get drive collector file", e);
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Failed to get drive collector file",
    };
  }
}

function getTypeKey(mimeType: string) {
  if (mimeType === DOC_MIME_TYPE) return "doc";
  if (mimeType === SHEETS_MIME_TYPE) return "sheet";
  if (mimeType === SLIDES_MIME_TYPE) return "slides";
  return "";
}

function quote(value: string) {
  return `'${value.replace(/'/g, "\\'")}'`;
}

/**
 * Lists files in a Google Drive folder.
 *
 * @param accessToken The access token to use for authentication.
 * @param url The URL to list files from.
 * @returns A promise that resolves to a list of files.
 */
function listFiles(
  accessToken: string,
  url: URL
): Promise<DriveListFilesResponse> {
  return fetchWithRetry(globalThis.fetch, url, {
    // Closure munges the header key so it needs to be quoted.
    // But prettier likes to remove the quotes.
    // prettier-ignore
    headers: { "Authorization": `Bearer ${accessToken}` },
  }).then((r) => r.json()) as Promise<DriveListFilesResponse>;
}
