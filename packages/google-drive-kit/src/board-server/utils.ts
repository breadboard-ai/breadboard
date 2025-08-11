/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DataPart,
  GraphDescriptor,
  GraphTag,
  LLMContent,
} from "@breadboard-ai/types";
import type { DriveFileId, NarrowedDriveFile } from "../google-drive-client.js";
import type { GraphInfo, StoredProperties } from "./operations.js";

/** Delay between GDrive API retries. */
const RETRY_MS = 200;

/**
 * Returns as much of leading characters from the `value` as would fit together with the key into
 * `limitBytes` with utf8 encoding.
 */
export function truncateValueForUtf8(
  key: string,
  value: string,
  limitBytes: number
): string {
  const getUtf8NumBytes = (value: string) =>
    new TextEncoder().encode(value).length;

  // Binary search the cut point.
  let startInd = 0;
  let endInd = value.length - 1;
  let leftOverIndex;
  while (startInd <= endInd) {
    const mid = Math.floor((startInd + endInd) / 2);
    const candidate = value.slice(0, mid + 1);
    const numBytes = getUtf8NumBytes(key + candidate);
    if (numBytes == limitBytes) {
      return candidate;
    } else if (numBytes < limitBytes) {
      // There may be more space left.
      startInd = mid + 1;
      leftOverIndex = startInd;
    } else {
      // Overrun.
      endInd = mid - 1;
      leftOverIndex = endInd;
    }
  }

  return value.slice(0, leftOverIndex);
}

/** Retries fetch() calls until status is not an internal server error. */
export async function retryableFetch(
  input: string | Request | URL,
  init?: RequestInit,
  numAttempts: 1 | 2 | 3 | 4 | 5 = 3
): Promise<Response> {
  function shouldRetry(response: Response): boolean {
    return 500 <= response.status && response.status <= 599;
  }

  async function recursiveHelper(numAttemptsLeft: number): Promise<Response> {
    numAttemptsLeft -= 1;
    let response: Response | null = null;
    try {
      response = await fetch(input, init);
      if (shouldRetry(response)) {
        console.warn(
          `Error in fetch(${input}). Attempts left: ${numAttemptsLeft}/${numAttempts}. Response:`,
          response
        );
      } else {
        return response;
      }
    } catch (e) {
      console.warn(
        `Exception in fetch(${input}). Attempts left: ${numAttemptsLeft}/${numAttempts}`,
        e
      );
      // return "403 Forbidden" response, as this is likely a CORS error
      response = new Response(null, {
        status: 403,
      });
    }

    if (numAttemptsLeft <= 0) {
      return response;
    }

    return await new Promise((resolve) => {
      setTimeout(async () => {
        resolve(await recursiveHelper(numAttemptsLeft));
      }, RETRY_MS);
    });
  }

  return recursiveHelper(numAttempts);
}

export function getSetsIntersection<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  if ("intersection" in set1) {
    return (set1.intersection as (set: Set<T>) => Set<T>)(set2) as Set<T>;
  }
  const result = new Set<T>();
  for (const item of set1) {
    if (set2.has(item)) {
      result.add(item);
    }
  }
  return result;
}

export function getSetsUnion<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  if ("union" in set1) {
    return (set1.union as (set: Set<T>) => Set<T>)(set2) as Set<T>;
  }
  const result = new Set<T>(set1);
  for (const item of set2) {
    result.add(item);
  }
  return result;
}

export function extractGoogleDriveFileId(str: string): string | null {
  return str.match(/^drive:\/?(.+)/)?.[1] ?? null;
}

/** Reads properties from the file, using both properties and appProperties (first priority). */
export function readProperties(
  file: NarrowedDriveFile<"properties" | "appProperties">
): AppProperties {
  const storedProperties: StoredProperties = {
    title: file.properties?.title || file.appProperties?.title,
    description:
      file.properties?.description || file.appProperties?.description || "",
    tags: file.properties?.tags || file.appProperties?.tags,
    thumbnailUrl:
      file.properties?.thumbnailUrl || file.appProperties?.thumbnailUrl,
    latestSharedVersion:
      file.properties?.latestSharedVersion ||
      file.appProperties?.latestSharedVersion,
  };

  let tags: Array<GraphTag> = [];
  try {
    tags = storedProperties.tags ? JSON.parse(storedProperties.tags) : [];
    if (!Array.isArray(tags)) tags = [];
  } catch (e) {
    console.info("Exception when parsing DriveFile.tags", e);
    // do nothing.
  }

  return {
    title: storedProperties.title ?? "",
    description: storedProperties.description ?? "",
    tags,
    thumbnailUrl: storedProperties.thumbnailUrl,
    latestSharedVersion: storedProperties.latestSharedVersion,
  };
}

export type AppProperties = {
  title: string;
  /** A truncated copy of the board description for listing. */
  description: string;
  tags: GraphTag[];
  thumbnailUrl?: string;
  latestSharedVersion?: string;
};

export type GoogleDriveAsset = {
  fileId: DriveFileId;
  /**
   * If an asset is "managed" by this graph, then it will automatically have its
   * sharing ACLs syncronized with the graph itself. If an asset is "unmanaged",
   * we will ask the user before modifying sharing ACLs.
   */
  managed: boolean;
};

export function findGoogleDriveAssetsInGraph(
  graph: GraphDescriptor
): GoogleDriveAsset[] {
  // Use a map because there can be duplicates.
  const files = new Map<string, GoogleDriveAsset>();

  if (graph.assets) {
    for (const asset of Object.values(graph.assets)) {
      // Cast needed because `data` is very broadly typed as `NodeValue`.
      const firstPart = (asset.data as LLMContent[])[0]?.parts?.[0];
      if (firstPart) {
        const fileId = partToDriveFileId(firstPart);
        if (fileId) {
          files.set(fileId.id, {
            fileId,
            managed: asset.metadata?.managed ?? false,
          });
        }
      }
    }
  }

  // Theme splash images are not listed in assets.
  const themes = graph.metadata?.visual?.presentation?.themes;
  if (themes) {
    for (const { splashScreen } of Object.values(themes)) {
      if (splashScreen) {
        const fileId = partToDriveFileId(splashScreen);
        if (fileId) {
          files.set(fileId.id, { fileId, managed: true });
        }
      }
    }
  }

  return [...files.values()];
}

export function partToDriveFileId(part: DataPart): DriveFileId | undefined {
  if ("storedData" in part) {
    const { handle, resourceKey } = part.storedData;
    const fileId = extractGoogleDriveFileId(handle);
    if (fileId) {
      return { id: fileId, resourceKey };
    }
  } else if ("fileData" in part) {
    const { fileUri, resourceKey } = part.fileData;
    if (fileUri.match(/^[a-zA-Z0-9_-]+$/)) {
      return { id: fileUri, resourceKey };
    }
  }
  return undefined;
}
type Permission = gapi.client.drive.Permission;

export function diffAssetReadPermissions(permissions: {
  actual: Permission[];
  expected: Permission[];
}): { missing: Permission[]; excess: Permission[] } {
  // Just ignore owner. We can't change that.
  const actual = permissions.actual.filter(({ role }) => role !== "owner");
  const expected = permissions.expected.filter(({ role }) => role !== "owner");

  const missing = [];
  {
    const actualStrs = new Set(actual.map(stringifyAssetReadPermission));
    for (const e of expected) {
      if (!actualStrs.has(stringifyAssetReadPermission(e))) {
        missing.push(e);
      }
    }
  }

  const excess = [];
  {
    const expectedStrs = new Set(expected.map(stringifyAssetReadPermission));
    for (const a of actual) {
      if (!expectedStrs.has(stringifyAssetReadPermission(a))) {
        excess.push(a);
      }
    }
  }

  return { missing, excess };
}

/**
 * Make a string from a permission object that can be used for Set membership.
 * Note we ignore "role" here, because we only care about reading, and all roles
 * can read.
 */
function stringifyAssetReadPermission(permission: Permission): string {
  return JSON.stringify({
    type: permission.type,
    domain: permission.domain ?? undefined,
    emailAddress: permission.emailAddress ?? undefined,
  });
}

export function permissionMatchesAnyOf(
  permission: Permission,
  candidates: Permission[]
): boolean {
  const str = stringifyAssetReadPermission(permission);
  for (const candidate of candidates) {
    if (str === stringifyAssetReadPermission(candidate)) {
      return true;
    }
  }
  return false;
}

export function driveFileToGraphInfo(
  file: NarrowedDriveFile<"id" | "name" | "properties">
): GraphInfo {
  const properties = readProperties(file);
  return {
    id: file.id,
    title: properties.title || file.name.replace(/(\.bgl)?\.json$/, ""),
    tags: properties.tags,
    thumbnail: properties.thumbnailUrl,
    description: properties.description,
    latestSharedVersion: properties.latestSharedVersion,
  };
}
