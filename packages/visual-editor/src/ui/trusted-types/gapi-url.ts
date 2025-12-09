/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// Note: As of December 2025, Firefox doesn't support Trusted Types.
const gapiURLPolicy = window.trustedTypes?.createPolicy("opal-gapi-url", {
  createScriptURL: createTrustedGapiURLImpl,
});

export const createTrustedGapiURL =
  gapiURLPolicy?.createScriptURL.bind(gapiURLPolicy) ??
  (createTrustedGapiURLImpl as unknown as (_: string) => TrustedScriptURL);

function createTrustedGapiURLImpl() {
  return "https://apis.google.com/js/api.js";
}
