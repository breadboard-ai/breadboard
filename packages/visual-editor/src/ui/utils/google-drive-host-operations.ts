/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleDriveClient } from "@breadboard-ai/utils/google-drive/google-drive-client.js";
import type {
  FindUserOpalFolderResult,
  GetDriveCollectorFileResult,
  ListUserOpalsResult,
} from "@breadboard-ai/types/opal-shell-protocol.js";

export { findUserOpalFolder, listUserOpals, getDriveCollectorFile };

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE =
  "application/vnd.google-apps.folder";
export const GRAPH_MIME_TYPE = "application/vnd.breadboard.graph+json";

export const IS_SHAREABLE_COPY_PROPERTY = "isShareableCopy";

export type FindUserOpalFolderArgs = {
  userFolderName: string;
  fetchWithCreds: typeof globalThis.fetch;
};

export type ListUserOpalsArgs = {
  isTestApi: boolean;
  fetchWithCreds: typeof globalThis.fetch;
};

export type GetDriveCollectorFileArgs = {
  mimeType: string;
  connectorId: string;
  graphId: string;
  fetchWithCreds: typeof globalThis.fetch;
};

const DOC_MIME_TYPE = "application/vnd.google-apps.document";
const SHEETS_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
const SLIDES_MIME_TYPE = "application/vnd.google-apps.presentation";

async function findUserOpalFolder(
  args: FindUserOpalFolderArgs
): Promise<FindUserOpalFolderResult> {
  const { userFolderName, fetchWithCreds } = args;
  const googleDriveClient = new GoogleDriveClient({ fetchWithCreds });
  const query = `name=${quote(userFolderName)}
  and mimeType="${GOOGLE_DRIVE_FOLDER_MIME_TYPE}"
  and trashed=false`;

  try {
    const response = await googleDriveClient.listFiles(query, {
      fields: ["id", "mimeType"],
      orderBy: [{ field: "createdTime", dir: "desc" }],
    });
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
  args: ListUserOpalsArgs
): Promise<ListUserOpalsResult> {
  const { isTestApi, fetchWithCreds } = args;
  const googleDriveClient = new GoogleDriveClient({ fetchWithCreds });
  const query = `mimeType = ${quote(GRAPH_MIME_TYPE)}
and trashed = false
and not properties has {
  key = ${quote(IS_SHAREABLE_COPY_PROPERTY)}
  and value = "true"
}
and 'me' in owners
  `;

  try {
    const response = await googleDriveClient.listFiles(query, {
      fields: [
        "id",
        "name",
        "modifiedTime",
        "properties",
        "appProperties",
        "isAppAuthorized",
      ],
      orderBy: [{ field: "modifiedTime", dir: "desc" }],
    });
    const files = response.files
      .filter(
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
      )
      .map((file) => ({
        ...file,
        // properties and appProperties are always optional from the Drive API
        // (even when requested), but ListDriveFileItem declares them required.
        properties: file.properties ?? {},
        appProperties: file.appProperties ?? {},
      }));

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
  args: GetDriveCollectorFileArgs
): Promise<GetDriveCollectorFileResult> {
  const { mimeType, connectorId, graphId, fetchWithCreds } = args;
  const googleDriveClient = new GoogleDriveClient({ fetchWithCreds });
  const fileKey = `${getTypeKey(mimeType)}${connectorId}${graphId}`;
  const query = `appProperties has { key = 'google-drive-connector' and value = '${fileKey}' } and trashed = false`;

  try {
    const response = await googleDriveClient.listFiles(query);
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
