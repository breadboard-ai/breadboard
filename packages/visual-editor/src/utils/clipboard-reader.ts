/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  FileDataPart,
  GraphDescriptor,
  GraphLoader,
  InlineDataCapabilityPart,
  TextCapabilityPart,
} from "@breadboard-ai/types";
import * as YouTube from "./media/youtube.js";
import { asBase64 } from "../data/common.js";

export { ClipboardReader };

export type GraphDescriptorType = {
  graphDescriptor: GraphDescriptor;
};

export type GraphUrlType = {
  graphUrl: string;
};

export type UnknownType = {
  unknown: true;
};

export type DetectedType =
  | GraphDescriptorType
  | GraphUrlType
  | InlineDataCapabilityPart
  | TextCapabilityPart
  | FileDataPart
  | UnknownType;

/**
 * Given a string, tries to detect the type it represents.
 */
class ClipboardReader {
  constructor(
    public readonly graphUrl: string | undefined,
    public readonly loader: GraphLoader
  ) {}

  async read(): Promise<DetectedType> {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const mimeType of item.types) {
        if (mimeType === "text/plain") {
          // Start with the most common.
          return this.readText();
        } else if (
          mimeType.startsWith("image") ||
          mimeType.startsWith("video") ||
          mimeType.startsWith("audio") ||
          mimeType === "application/pdf" ||
          mimeType === "text/html"
        ) {
          return {
            inlineData: {
              mimeType,
              data: await asBase64(await item.getType(mimeType)),
            },
          };
        }
      }
    }
    return this.unknown();
  }

  unknown(): UnknownType {
    return { unknown: true };
  }

  async isGraphUrl(url: string) {
    const loading = await this.loader.load(url);
    return loading.success;
  }

  async readText(): Promise<DetectedType> {
    // Let's see if this is actually JSON.
    const text = await navigator.clipboard.readText();
    const maybeJson = tryParsingJson(text);
    if (maybeJson) {
      // Let's see if this might be a graph descriptor
      if (isGraphDescriptor(maybeJson)) {
        return { graphDescriptor: maybeJson };
      }
    }
    // Let's see if this is a URL.
    if (isUrl(text, this.graphUrl)) {
      const url = text;
      // First, let's see if this a YT video.
      const fileUri = tryParsingYouTubeUrl(url);
      if (fileUri) {
        return { fileData: { fileUri, mimeType: "video/mp4" } };
      }
      // Now, let's see if there is a valid graph behind this.
      const isGraphUrl = await this.isGraphUrl(url);
      if (isGraphUrl) {
        return { graphUrl: url };
      }
      // Ok, give up -- this is probably a file to load.
      return {
        fileData: { fileUri: url, mimeType: "application/octet-stream" },
      };
    }
    return { text };
  }
}

function isGraphDescriptor(s: GraphDescriptor) {
  return s.nodes && s.edges && s.title;
}

function tryParsingYouTubeUrl(s: string) {
  let fileUri: string | null = s;
  const {
    isEmbedUri,
    isShareUri,
    isWatchUri,
    convertShareUriToEmbedUri,
    convertWatchOrShortsUriToEmbedUri,
  } = YouTube;
  if (isWatchUri(fileUri) || YouTube.isShortsUri(fileUri)) {
    fileUri = convertWatchOrShortsUriToEmbedUri(fileUri);
  } else if (isShareUri(fileUri)) {
    fileUri = convertShareUriToEmbedUri(fileUri);
  } else if (!isEmbedUri(fileUri)) {
    fileUri = null;
  }
  return fileUri;
}

function tryParsingJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// We do this unusual concatenation to bamboozle TypeScript. If we just check
// for the presence of 'canParse' in URL then the else case assumes we're
// dealing with the nodejs version of URL, which isn't necessarily the case; we
// could just as well be dealing with an older browser version. So we do this
// concatenation which is functionally inert but which means the TypeScript
// compiler continues to work on the assumption that it's a browser URL.
const cP = "" + "canParse";
function isUrl(urlLike: string, base?: string): boolean {
  const maybeFragment = urlLike.startsWith("#");

  if (cP in URL) {
    if (maybeFragment) {
      return URL.canParse(urlLike, base);
    }
    return URL.canParse(urlLike);
  }

  try {
    if (maybeFragment) {
      new URL(urlLike, base);
    } else {
      new URL(urlLike);
    }
    return true;
  } catch {
    return false;
  }
}
