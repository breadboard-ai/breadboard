/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GraphDescriptor, JsonSerializable } from "@breadboard-ai/types";
import { FileSystemEntry } from "../types.js";
import { isLLMContentArray } from "../common.js";

export { assetsFromGraphDescriptor, envFromGraphDescriptor };

function envFromGraphDescriptor(
  current: FileSystemEntry[],
  descriptor?: GraphDescriptor
): FileSystemEntry[] {
  if (!descriptor) return [...current];

  const { title, description, url, version, metadata } = descriptor;

  const json = {
    title,
    description,
    url,
    version,
    ...metadata,
  } as JsonSerializable;

  return [
    ...current,
    {
      path: "/env/metadata",
      data: [{ parts: [{ json }] }],
    },
  ];
}

function assetsFromGraphDescriptor(
  descriptor?: GraphDescriptor
): FileSystemEntry[] {
  const { assets } = descriptor || {};
  if (!assets) return [];

  return Object.entries(assets)
    .filter(([, asset]) => isLLMContentArray(asset.data))
    .map(([path, asset]) => {
      const data = asset.data;
      return { path: `/assets/${path}`, data } as FileSystemEntry;
    });
}
