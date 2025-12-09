/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export type MakeShareLinkFromTemplate = {
  urlTemplate: string;
  fileId: string;
  resourceKey: string | undefined;
};

export function makeShareLinkFromTemplate({
  urlTemplate,
  fileId,
  resourceKey,
}: MakeShareLinkFromTemplate): string {
  const url = new URL(
    urlTemplate
      .replaceAll("{fileId}", fileId)
      .replaceAll("{resourceKey}", resourceKey ?? "")
  );
  // Remove any empty parameters. A slightly hacky way to clean up resourceKey
  // parameters when there is no resourceKey.
  for (const [name, value] of url.searchParams) {
    if (!value) {
      url.searchParams.delete(name);
    }
  }
  return url.href;
}
