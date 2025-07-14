/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { GraphTag } from "@breadboard-ai/types";
import type { StoredProperties } from "./operations.js";
import type { NarrowedDriveFile } from "../google-drive-client.js";

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
  file: NarrowedDriveFile<["properties", "appProperties"]>
): AppProperties {
  const storedProperties: StoredProperties = {
    title: file.properties?.title || file.appProperties?.title,
    description:
      file.properties?.description || file.appProperties?.description || "",
    tags: file.properties?.tags || file.appProperties?.tags,
    thumbnailUrl:
      file.properties?.thumbnailUrl || file.appProperties?.thumbnailUrl,
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
  };
}

export type AppProperties = {
  title: string;
  /** A truncated copy of the board description for listing. */
  description: string;
  tags: GraphTag[];
  thumbnailUrl?: string;
};
