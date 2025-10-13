/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export { hasExpired };

const EXPIRATION_BUFFER_MS = 1_000 * 60 * 60;

function hasExpired(expirationTime?: string) {
  if (!expirationTime) return true;
  const expiresOn = new Date(expirationTime).getTime() - EXPIRATION_BUFFER_MS;
  return expiresOn < Date.now();
}
