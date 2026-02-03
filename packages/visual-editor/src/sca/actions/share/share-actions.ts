/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphDescriptor } from "@breadboard-ai/types";
import {
  diffAssetReadPermissions,
  extractGoogleDriveFileId,
  permissionMatchesAnyOf,
} from "@breadboard-ai/utils/google-drive/utils.js";
import {
  DRIVE_PROPERTY_IS_SHAREABLE_COPY,
  DRIVE_PROPERTY_LATEST_SHARED_VERSION,
  DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY,
  DRIVE_PROPERTY_OPAL_SHARE_SURFACE,
  DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN,
} from "@breadboard-ai/utils/google-drive/operations.js";
import { GoogleDriveBoardServer } from "../../../board-server/server.js";
import { makeAction } from "../binder.js";

export const bind = makeAction();

export async function readPublishedState(
  graph: GraphDescriptor | undefined,
  publishPermissions: gapi.client.drive.Permission[]
): Promise<void> {
  const { controller, services } = bind;
  const share = controller.editor.share;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  const graphUrl = graph?.url;
  if (!graphUrl) {
    console.error(`No graph url`);
    return;
  }
  const thisFileId = getGraphFileId(graphUrl);
  if (!thisFileId) {
    console.error(`No file id`);
    return;
  }
  if (!googleDriveClient) {
    console.error(`No google drive client provided`);
    return;
  }
  if (!boardServer) {
    console.error(`No board server provided`);
    return;
  }
  if (!(boardServer instanceof GoogleDriveBoardServer)) {
    console.error(`Provided board server was not Google Drive`);
    return;
  }

  share.state = { status: "loading" };

  // Ensure any pending changes are saved so that our Drive operations will be
  // synchronized with those changes.
  await boardServer.flushSaveQueue(graphUrl);

  const thisFileMetadata = await googleDriveClient.getFileMetadata(
    thisFileId,
    {
      fields: ["resourceKey", "properties", "ownedByMe", "version"],
      // Sometimes we are working on the featured gallery items themselves. In
      // that case, and for all such calls in this file, we should never use
      // the gallery proxy, because otherwise we will get responses that are
      // (1) potentially stale because of caching, (2) missing data because
      // we're not using the owning user's credentials (e.g. permissions get
      // masked out and appear empty).
      bypassProxy: true,
    }
  );

  const thisFileIsAShareableCopy =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN] !==
    undefined;
  if (thisFileIsAShareableCopy) {
    share.state = {
      status: "readonly",
      shareableFile: {
        id: thisFileId,
        resourceKey: thisFileMetadata.resourceKey,
      },
    };
    return;
  }

  const shareableCopyFileId =
    thisFileMetadata.properties?.[DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY];

  if (!thisFileMetadata.ownedByMe) {
    share.state = {
      status: "readonly",
      shareableFile: shareableCopyFileId
        ? {
          id: shareableCopyFileId,
          resourceKey: (
            await googleDriveClient.getFileMetadata(
              shareableCopyFileId,
              {
                fields: ["resourceKey"],
                bypassProxy: true,
              }
            )
          ).resourceKey,
        }
        : {
          id: thisFileId,
          resourceKey: thisFileMetadata.resourceKey,
        },
    };
    return;
  }

  if (!shareableCopyFileId) {
    share.state = {
      status: "writable",
      published: false,
      granularlyShared: false,
      shareableFile: undefined,
      latestVersion: thisFileMetadata.version,
      userDomain: (await services.signinAdapter.domain) ?? "",
    };
    return;
  }

  const shareableCopyFileMetadata =
    await googleDriveClient.getFileMetadata(shareableCopyFileId, {
      fields: ["resourceKey", "properties", "permissions"],
      bypassProxy: true,
    });
  const allGraphPermissions = shareableCopyFileMetadata.permissions ?? [];
  const diff = diffAssetReadPermissions({
    actual: allGraphPermissions,
    expected: publishPermissions,
  });

  share.state = {
    status: "writable",
    published: diff.missing.length === 0,
    publishedPermissions: allGraphPermissions.filter((permission) =>
      permissionMatchesAnyOf(
        permission,
        publishPermissions
      )
    ),
    granularlyShared:
      // We're granularly shared if there is any permission that is neither
      // one of the special publish permissions, nor the owner (since there
      // will always an owner).
      diff.excess.find((permission) => permission.role !== "owner") !==
      undefined,
    shareableFile: {
      id: shareableCopyFileId,
      resourceKey: shareableCopyFileMetadata.resourceKey,
      stale:
        thisFileMetadata.version !==
        shareableCopyFileMetadata.properties?.[
        DRIVE_PROPERTY_LATEST_SHARED_VERSION
        ],
      permissions: shareableCopyFileMetadata.permissions ?? [],
      shareSurface:
        shareableCopyFileMetadata.properties?.[
        DRIVE_PROPERTY_OPAL_SHARE_SURFACE
        ],
    },
    latestVersion: thisFileMetadata.version,
    userDomain: (await services.signinAdapter.domain) ?? "",
  };

  console.debug(
    `[Sharing] Found sharing state:` +
    ` ${JSON.stringify(share.state, null, 2)}`
  );
}

function getGraphFileId(graphUrl: string): string | undefined {
  if (!graphUrl.startsWith("drive:")) {
    console.error(
      `Expected "drive:" prefixed graph URL, got ${JSON.stringify(graphUrl)}`
    );
    return undefined;
  }
  const graphFileId = graphUrl.replace(/^drive:\/*/, "");
  if (!graphFileId) {
    console.error(`Graph file ID was empty`);
  }
  return graphFileId;
}

export interface MakeShareableCopyResult {
  shareableCopyFileId: string;
  shareableCopyResourceKey: string | undefined;
  newMainVersion: string;
}

export async function makeShareableCopy(
  graph: GraphDescriptor | undefined,
  shareSurface: string | undefined
): Promise<MakeShareableCopyResult> {
  const { services } = bind;
  const googleDriveClient = services.googleDriveClient;
  const boardServer = services.googleDriveBoardServer;

  if (!googleDriveClient) {
    throw new Error(`No google drive client provided`);
  }
  if (!boardServer) {
    throw new Error(`No board server provided`);
  }
  if (!(boardServer instanceof GoogleDriveBoardServer)) {
    throw new Error(`Provided board server was not Google Drive`);
  }
  if (!graph) {
    throw new Error(`Graph was not provided`);
  }
  if (!graph.url) {
    throw new Error(`Graph had no URL`);
  }
  const mainFileId = extractGoogleDriveFileId(graph.url);
  if (!mainFileId) {
    throw new Error(
      `Graph URL did not contain a Google Drive file id: ${graph.url}`
    );
  }

  const shareableFileName = `${mainFileId}-shared.bgl.json`;
  const shareableGraph = structuredClone(graph);
  delete shareableGraph["url"];

  const createResult = await boardServer.create(
    // Oddly, the title of the file is extracted from a URL that is passed in,
    // even though URLs of this form are otherwise totally invalid.
    //
    // TODO(aomarks) This doesn't seem to actually work. The title is in fact
    // taken from the descriptor. So what is the purpose of passing a URL
    // here?
    new URL(`drive:/${shareableFileName}`),
    shareableGraph
  );
  const shareableCopyFileId = extractGoogleDriveFileId(
    createResult.url ?? ""
  );
  if (!shareableCopyFileId) {
    console.error(`Unexpected create result`, createResult);
    throw new Error(`Error creating shareable file`);
  }

  // Update the latest version property on the main file.
  const updateMainResult = await googleDriveClient.updateFileMetadata(
    mainFileId,
    {
      properties: {
        [DRIVE_PROPERTY_MAIN_TO_SHAREABLE_COPY]: shareableCopyFileId,
      },
    },
    { fields: ["version"] }
  );

  // Ensure the creation of the copy has fully completed.
  //
  // TODO(aomarks) Move more sharing logic into board server so that this
  // create/update coordination doesn't need to be a concern of this
  // component.
  await boardServer.flushSaveQueue(`drive:/${shareableCopyFileId}`);

  const shareableCopyMetadata =
    await googleDriveClient.updateFileMetadata(
      shareableCopyFileId,
      {
        properties: {
          [DRIVE_PROPERTY_SHAREABLE_COPY_TO_MAIN]: mainFileId,
          [DRIVE_PROPERTY_LATEST_SHARED_VERSION]: updateMainResult.version,
          [DRIVE_PROPERTY_IS_SHAREABLE_COPY]: "true",
          ...(shareSurface
            ? { [DRIVE_PROPERTY_OPAL_SHARE_SURFACE]: shareSurface }
            : {}),
        },
      },
      { fields: ["resourceKey"] }
    );

  console.debug(
    `[Sharing] Made a new shareable graph copy "${shareableCopyFileId}"` +
    ` at version "${updateMainResult.version}".`
  );
  return {
    shareableCopyFileId,
    shareableCopyResourceKey: shareableCopyMetadata.resourceKey,
    newMainVersion: updateMainResult.version,
  };
}
