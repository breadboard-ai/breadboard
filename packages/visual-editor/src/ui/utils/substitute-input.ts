/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { LLMContent } from "@breadboard-ai/types";
import {
  convertShareUriToEmbedUri,
  convertWatchOrShortsUriToEmbedUri,
  createWatchUriFromVideoId,
  isShareUri,
  isWatchUri,
  videoIdFromWatchOrShortsOrEmbedUri,
} from "../../utils/media/youtube.js";

export function maybeConvertToYouTube(input: string): string | LLMContent {
  let converted: string | null = null;
  if (isShareUri(input)) {
    converted = convertShareUriToEmbedUri(input);
  } else if (isWatchUri(input)) {
    converted = convertWatchOrShortsUriToEmbedUri(input);
  }

  if (converted) {
    const videoId = videoIdFromWatchOrShortsOrEmbedUri(converted);
    if (videoId) {
      const fileUri = createWatchUriFromVideoId(videoId);

      return {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri,
              mimeType: "video/mp4",
            },
          },
        ],
      } satisfies LLMContent;
    }
  }

  return input;
}
