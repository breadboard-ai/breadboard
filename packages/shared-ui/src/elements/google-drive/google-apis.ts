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
export async function loadGapi(): Promise<typeof globalThis.gapi> {
  return (gapiPromise ??= (async () => {
    await loadNonModuleWithHeadScriptTag("https://apis.google.com/js/api.js");
    return globalThis.gapi;
  })());
}

let gapiClientPromise: Promise<typeof globalThis.gapi.client>;
/**
 * Load the GAPI (Google API) Client library.
 *
 * See https://github.com/google/google-api-javascript-client/blob/master/docs/reference.md
 */
export async function loadGapiClient(): Promise<typeof globalThis.gapi.client> {
  return (gapiClientPromise ??= (async () => {
    const gapi = await loadGapi();
    await new Promise<void>((resolve) => gapi.load("client", () => resolve()));
    return globalThis.gapi.client;
  })());
}

let driveApiPromise: Promise<typeof globalThis.gapi.client.drive>;
/**
 * Load the the GAPI (Google API) Drive API.
 *
 * See https://developers.google.com/drive/api/reference/rest/v3
 */
export async function loadDriveApi(): Promise<
  typeof globalThis.gapi.client.drive
> {
  return (driveApiPromise ??= (async () => {
    const gapiClient = await loadGapiClient();
    await gapiClient.load(
      "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"
    );
    return globalThis.gapi.client.drive;
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
    await Promise.all([
      loadDriveApi(),
      (async () => {
        const gapi = await loadGapi();
        await new Promise((resolve) => gapi.load("picker", resolve));
      })(),
    ]);
    return globalThis.google.picker;
  })());
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace gapi.drive.share {
  class ShareClient {
    setOAuthToken: (oauthToken: string) => void;
    setItemIds: (itemIds: string[]) => void;
    showSettingsDialog: () => void;
  }
}

let sharingDialogPromise: Promise<typeof gapi.drive.share>;
/**
 * Load the the GAPI (Google API) Drive Sharing Dialog API.
 *
 * See https://developers.google.com/workspace/drive/api/guides/share-button
 */
export async function loadDriveShare(): Promise<typeof gapi.drive.share> {
  return (sharingDialogPromise ??= (async () => {
    await Promise.all([
      (async () => {
        const gapi = await loadGapi();
        await new Promise((resolve) => gapi.load("drive-share", resolve));
      })(),
    ]);
    return gapi.drive.share;
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
