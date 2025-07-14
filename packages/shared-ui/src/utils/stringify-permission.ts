/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type GoogleDrivePermission } from "../contexts/global-config";

/**
 * Make a string from a permission object that can be used for Set membership.
 */
export function stringifyPermission(
  permission: gapi.client.drive.Permission
): string {
  if (permission.type === "user") {
    return `user:${permission.emailAddress}:${permission.role}`;
  }
  if (permission.type === "group") {
    return `group:${permission.emailAddress}:${permission.role}`;
  }
  if (permission.type === "domain") {
    return `domain:${permission.domain}:${permission.role}`;
  }
  if (permission.type === "anyone") {
    return `anyone:${permission.role}`;
  }
  // Don't throw because Google Drive could add new permission types in the
  // future, and that shouldnt be fatal. Instead return the unique ID of the
  // permission (or something random if it doesn't have an ID), so that it will
  // never be treated as equal to a different permission object (since by
  // definition, we don't know what that would mean).
  console.error(
    `Unexpected permission type "${(permission as GoogleDrivePermission).type}"`
  );
  return (
    `error` +
    `:${(permission as GoogleDrivePermission).type}` +
    `:${(permission as GoogleDrivePermission).id || Math.random()}` +
    `:${permission.role}`
  );
}
