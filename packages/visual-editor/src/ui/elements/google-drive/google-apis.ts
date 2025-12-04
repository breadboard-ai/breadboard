/**
 * @license
 * Copyright 2024 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="@types/gapi" />
/// <reference types="@types/gapi.client.drive-v3" />
/// <reference types="@types/google.picker" />

let gapiPromise: Promise<typeof globalThis.gapi>;
/**
 * Load the top-level GAPI (Google API) library.
 *
 * See https://github.com/google/google-api-javascript-client/blob/master/docs/reference.md
 */
async function loadGapi(): Promise<typeof globalThis.gapi> {
  return (gapiPromise ??= (async () => {
    await loadNonModuleWithHeadScriptTag("https://apis.google.com/js/api.js");
    return globalThis.gapi;
  })());
}

let drivePickerPromise: Promise<typeof globalThis.google.picker>;
/**
 * Load the the GAPI (Google API) Drive Picker API.
 *
 * See https://developers.google.com/drive/picker/reference
 */
export async function loadDrivePicker(): Promise<
  typeof globalThis.google.picker
> {
  return (drivePickerPromise ??= (async () => {
    const gapi = await loadGapi();
    await new Promise((resolve) => gapi.load("picker", resolve));
    return globalThis.google.picker;
  })());
}

export interface ShareClient {
  setOAuthToken: (oauthToken: string) => void;
  setItemIds: (itemIds: string[]) => void;
  showSettingsDialog: () => void;
}

let shareClientPromise: Promise<new () => ShareClient>;
/**
 * Load the the GAPI (Google API) Drive Sharing Dialog API.
 *
 * See https://developers.google.com/workspace/drive/api/guides/share-button
 */
export async function loadDriveShareClient(): Promise<new () => ShareClient> {
  return (shareClientPromise ??= (async () => {
    const gapi = await loadGapi();
    await new Promise((resolve) => gapi.load("drive-share", resolve));
    return (
      gapi as object as {
        drive: { share: { ShareClient: new () => ShareClient } };
      }
    ).drive.share.ShareClient;
  })());
}

/**
 * This is like `import`, except for JavaScript that can't be executed as a
 * module, like GAPI.
 *
 * This function does NOT implement caching.
 */
async function loadNonModuleWithHeadScriptTag(src: string): Promise<void> {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;

  let resolve: () => void;
  let reject: () => void;
  const promise = new Promise<void>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  const cancel = new AbortController();
  script.addEventListener(
    "load",
    () => {
      resolve();
      cancel.abort();
    },
    { once: true, signal: cancel.signal }
  );
  script.addEventListener(
    "error",
    () => {
      reject();
      cancel.abort();
    },
    { once: true, signal: cancel.signal }
  );

  document.head.appendChild(script);
  return promise;
}
